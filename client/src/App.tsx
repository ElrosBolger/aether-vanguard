import { useEffect, useRef, useState } from 'react';
import { ensureAccessToken, AuthError } from './api/auth';
import { GameNetworkClient, type ConnectionStatus } from './network/GameNetworkClient';
import type { Vec2 } from '@shared/movementSimulation';

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL as string;

function useKeyboardInputVector() {
  const pressed = useRef(new Set<string>());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => pressed.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => pressed.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return () => {
    const keys = pressed.current;
    let moveX = 0;
    let moveY = 0;
    if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
    if (keys.has('s') || keys.has('arrowdown')) moveY += 1;
    if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
    if (keys.has('d') || keys.has('arrowright')) moveX += 1;
    return { moveX, moveY };
  };
}

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localPos, setLocalPos] = useState<Vec2>({ x: 0, y: 0 });

  const getInputVector = useKeyboardInputVector();
  const networkRef = useRef<GameNetworkClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let lastTime = performance.now();

    async function bootstrap() {
      try {
        const accessToken = await ensureAccessToken();
        if (cancelled) return;

        const network = new GameNetworkClient(COLYSEUS_URL, getInputVector, {
          onStatusChange: setStatus,
          onError: setError,
        });
        networkRef.current = network;

        await network.connect(accessToken);

        const loop = (now: number) => {
          const delta = (now - lastTime) / 1000;
          lastTime = now;

          network.update(delta);
          const pos = network.getLocalRenderPosition();
          if (pos) setLocalPos(pos);

          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
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
      cancelAnimationFrame(rafId);
      networkRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        gap: '0.5rem',
      }}
    >
      <h1 style={{ letterSpacing: '0.1em' }}>AETHER VANGUARD</h1>
      <p>Stato connessione: {status}</p>
      <p>
        Posizione (WASD/frecce): x={localPos.x.toFixed(2)}, y={localPos.y.toFixed(2)}
      </p>
      {error && <p style={{ color: '#C0392B' }}>{error}</p>}
    </main>
  );
}
