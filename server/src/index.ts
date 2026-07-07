import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WorldRoom } from './rooms/WorldRoom';

const PORT = Number(process.env.PORT) || 2567;

const app = express();
const httpServer = createServer(app);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'aether-vanguard-server' });
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('world', WorldRoom);

httpServer.listen(PORT, () => {
  console.log(`[Aether Vanguard] Colyseus in ascolto sulla porta ${PORT}`);
});
