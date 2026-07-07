import { Client, Room } from 'colyseus.js';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface NetworkClientEvents {
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (message: string) => void;
}

export class GameNetworkClient {
  private client: Client;
  private room: Room | null = null;
  private status: ConnectionStatus = 'idle';

  constructor(private serverUrl: string, private events: NetworkClientEvents = {}) {
    this.client = new Client(serverUrl);
  }

  async connect(accessToken: string): Promise<Room> {
    this.setStatus('connecting');

    try {
      this.room = await this.client.joinOrCreate('world', { accessToken });
      this.setStatus('connected');

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

  getRoom(): Room | null {
    return this.room;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this.setStatus('idle');
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.events.onStatusChange?.(status);
  }
}
