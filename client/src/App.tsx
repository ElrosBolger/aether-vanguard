import { useEffect, useState } from 'react';
import { ensureAccessToken, AuthError } from './api/auth';
import { GameNetworkClient, type ConnectionStatus } from './network/GameNetworkClient';

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL as string;

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let network: GameNetworkClient | null = null;
    let cancelled = false;

    async function bootstrap() {
      try {
        const accessToken = await ensureAccessToken();
        if (cancelled) return;

        network = new GameNetworkClient(COLYSEUS_URL, {
          onStatusChange: setStatus,
          onError: setError,
        });

        await network.connect(accessToken);
      } catch (err) {
        const message =
          err instanceof AuthError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Errore di avvio sconosciuto';
        setError(message);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      network?.disconnect();
    };
  }, []);

  return (
    <main
      style={{
        background: '#0A0A0A',
        color: '#D4AF37',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ letterSpacing: '0.1em' }}>AETHER VANGUARD</h1>
      <p>Stato connessione: {status}</p>
      {error && <p style={{ color: '#C0392B' }}>{error}</p>}
    </main>
  );
}
