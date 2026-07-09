import { Client, Room } from 'colyseus.js';
import { PredictionController, type ServerSnapshot } from './PredictionController';
import { RemoteEntityInterpolator } from './RemoteEntityInterpolator';
import { STARTING_ZONE_OBSTACLES } from '@shared/mapConfig';
import type { InputPacket, Vec2 } from '@shared/movementSimulation';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface NetworkClientEvents {
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (message: string) => void;
}

type GetInputVectorFn = () => { moveX: number; moveY: number };

export class GameNetworkClient {
  private client: Client;
  private room: Room | null = null;
  private status: ConnectionStatus = 'idle';
  private localSessionId = '';

  private prediction: PredictionController | null = null;
  private interpolator = new RemoteEntityInterpolator();

  constructor(
    serverUrl: string,
    private getInputVector: GetInputVectorFn,
    private events: NetworkClientEvents = {}
  ) {
    this.client = new Client(serverUrl);
  }

  async connect(accessToken: string): Promise<Room> {
    this.setStatus('connecting');

    try {
      this.room = await this.client.joinOrCreate('world', { accessToken });
      this.localSessionId = this.room.sessionId;
      this.setStatus('connected');

      this.prediction = new PredictionController(
        { x: 0, y: 0 },
        STARTING_ZONE_OBSTACLES,
        this.getInputVector,
        (input: InputPacket) => this.room!.send('input', input)
      );

      this.room.state.players.onAdd((player: any, sessionId: string) => {
        if (sessionId === this.localSessionId) {
          player.onChange(() => {
            const snapshot: ServerSnapshot = {
              lastProcessedInputSeq: player.lastProcessedInputSeq,
              x: player.x,
              y: player.y,
            };
            this.prediction?.onServerSnapshot(snapshot);
          });
          return;
        }

        this.interpolator.addSnapshot(sessionId, { x: player.x, y: player.y });
        player.onChange(() => {
          this.interpolator.addSnapshot(sessionId, { x: player.x, y: player.y });
        });
      });

      this.room.state.players.onRemove((_player: any, sessionId: string) => {
        this.interpolator.removeEntity(sessionId);
      });

      this.room.onError((code, message) => {
        this.setStatus('error');
        this.events.onError?.(`Errore room (${code}): ${message ?? 'sconosciuto'}`);
      });

      this.room.onLeave(() => {
        this.setStatus('idle');
      });

      return this.room;
    } catch (err) {
      this.setStatus('error');
      const message = err instanceof Error ? err.message : 'Connessione fallita';
      this.events.onError?.(message);
      throw err;
    }
  }

  update(deltaSeconds: number): void {
    this.prediction?.update(deltaSeconds);
  }

  getLocalRenderPosition(): Vec2 | null {
    return this.prediction?.getRenderPosition() ?? null;
  }

  getRemoteRenderPosition(sessionId: string): Vec2 | null {
    return this.interpolator.getInterpolatedPosition(sessionId);
  }

  getRemoteSessionIds(): string[] {
    if (!this.room) return [];
    return Array.from(this.room.state.players.keys() as Iterable<string>).filter(
      (id) => id !== this.localSessionId
    );
  }

  getRoom(): Room | null {
    return this.room;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this.prediction = null;
    this.setStatus('idle');
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.events.onStatusChange?.(status);
  }
}
