import type { Vec2 } from '@shared/movementSimulation';

interface BufferedSnapshot {
  receivedAt: number;
  position: Vec2;
}

const INTERP_DELAY_MS = 100;
const MAX_BUFFER_SIZE = 20;

export class RemoteEntityInterpolator {
  private buffers = new Map<string, BufferedSnapshot[]>();

  addSnapshot(entityId: string, position: Vec2): void {
    const buffer = this.buffers.get(entityId) ?? [];
    buffer.push({ receivedAt: performance.now(), position });

    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }

    this.buffers.set(entityId, buffer);
  }

  removeEntity(entityId: string): void {
    this.buffers.delete(entityId);
  }

  /**
   * Call every frame to get the interpolated position to render.
   * Returns null if no data yet (player just joined, no snapshot received).
   */
  getInterpolatedPosition(entityId: string): Vec2 | null {
    const buffer = this.buffers.get(entityId);
    if (!buffer || buffer.length < 2) {
      return buffer?.[0]?.position ?? null;
    }

    const renderTime = performance.now() - INTERP_DELAY_MS;

    for (let i = buffer.length - 1; i > 0; i--) {
      const newer = buffer[i];
      const older = buffer[i - 1];

      if (older.receivedAt <= renderTime && renderTime <= newer.receivedAt) {
        const span = newer.receivedAt - older.receivedAt || 1;
        const t = (renderTime - older.receivedAt) / span;
        return {
          x: older.position.x + (newer.position.x - older.position.x) * t,
          y: older.position.y + (newer.position.y - older.position.y) * t,
        };
      }
    }

    return buffer[buffer.length - 1].position;
  }
}
