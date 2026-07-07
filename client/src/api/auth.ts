const ACCESS_TOKEN_KEY = 'av_access_token';
const ACCESS_TOKEN_EXPIRY_KEY = 'av_access_token_expiry';

interface TelegramAuthResponse {
  accessToken: string;
  expiresIn: number;
  playerId: string;
}

interface TelegramWebApp {
  initData: string;
  ready: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export class AuthError extends Error {}

export async function loginWithTelegram(): Promise<string> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) {
    throw new AuthError('App non aperta dentro Telegram: initData assente.');
  }

  const response = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: webApp.initData }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
    throw new AuthError(body.error ?? `Login fallito (${response.status})`);
  }

  const data: TelegramAuthResponse = await response.json();
  persistSession(data.accessToken, data.expiresIn);
  return data.accessToken;
}

export function getStoredAccessToken(): string | null {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiry = window.localStorage.getItem(ACCESS_TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;

  const isExpired = Date.now() > Number(expiry) - 30_000;
  if (isExpired) {
    clearSession();
    return null;
  }
  return token;
}

export function clearSession(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_EXPIRY_KEY);
}

function persistSession(accessToken: string, expiresIn: number): void {
  const expiryTimestamp = Date.now() + expiresIn * 1000;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, String(expiryTimestamp));
}

export async function ensureAccessToken(): Promise<string> {
  const cached = getStoredAccessToken();
  if (cached) return cached;
  return loginWithTelegram();
}
