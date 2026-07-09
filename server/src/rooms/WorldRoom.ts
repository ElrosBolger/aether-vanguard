import { Room, Client } from '@colyseus/core';
import jwt from 'jsonwebtoken';
import { WorldState, PlayerState } from '../schema/WorldState';
import {
  FIXED_DT,
  simulateStep,
  type InputPacket,
} from '@shared/movementSimulation';
import { STARTING_ZONE_OBSTACLES } from '@shared/mapConfig';
import type { SessionTokenPayload } from '@shared/authTypes';

const MAP_OBSTACLES = STARTING_ZONE_OBSTACLES;

const MAX_INPUTS_PER_TICK = 3;
const MAX_PENDING_QUEUE = 30;

interface JoinOptions {
  accessToken: string;
}

interface PendingClientData {
  queue: InputPacket[];
  lastSeq: number;
}

export class WorldRoom extends Room<WorldState> {
  private pending = new Map<string, PendingClientData>();
  private activePlayerIds = new Set<string>();

  onCreate(): void {
    this.state = new WorldState();
    this.setSimulationInterval(() => this.fixedTick(), FIXED_DT * 1000);

    this.onMessage('input', (client, input: InputPacket) => {
      this.handleInput(client, input);
    });
  }

  async onAuth(client: Client, options: JoinOptions): Promise<SessionTokenPayload> {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error('Configurazione server incompleta: SUPABASE_JWT_SECRET mancante');
    }

    if (!options?.accessToken) {
      throw new Error('accessToken mancante');
    }

    let payload: SessionTokenPayload;
    try {
      payload = jwt.verify(options.accessToken, secret) as SessionTokenPayload;
    } catch {
      throw new Error('Token non valido o scaduto');
    }

    if (!payload.sub || payload.role !== 'authenticated' || !payload.telegram_id) {
      throw new Error('Token malformato');
    }

    if (this.activePlayerIds.has(payload.sub)) {
      throw new Error('Account già connesso da un altro dispositivo');
    }

    return payload;
  }

  onJoin(client: Client, _options: JoinOptions, auth: SessionTokenPayload): void {
    this.activePlayerIds.add(auth.sub);

    const player = new PlayerState();
    player.playerId = auth.sub;
    player.username = `Vanguard-${auth.telegram_id}`;
    player.x = 0;
    player.y = 0;
    player.lastProcessedInputSeq = 0;

    this.state.players.set(client.sessionId, player);
    this.pending.set(client.sessionId, { queue: [], lastSeq: -1 });
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) this.activePlayerIds.delete(player.playerId);

    this.state.players.delete(client.sessionId);
    this.pending.delete(client.sessionId);
  }

  private handleInput(client: Client, input: InputPacket): void {
    const data = this.pending.get(client.sessionId);
    if (!data) return;

    if (input.seq <= data.lastSeq) return;

    input.moveX = clamp(input.moveX, -1, 1);
    input.moveY = clamp(input.moveY, -1, 1);

    if (data.queue.length >= MAX_PENDING_QUEUE) return;

    data.lastSeq = input.seq;
    data.queue.push(input);
  }

  private fixedTick(): void {
    for (const [sessionId, player] of this.state.players.entries()) {
      const data = this.pending.get(sessionId);
      if (!data || data.queue.length === 0) continue;

      const toProcess = data.queue.splice(0, MAX_INPUTS_PER_TICK);

      for (const input of toProcess) {
        const result = simulateStep({ x: player.x, y: player.y }, input, MAP_OBSTACLES);
        player.x = result.x;
        player.y = result.y;
        player.lastProcessedInputSeq = input.seq;
      }
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
