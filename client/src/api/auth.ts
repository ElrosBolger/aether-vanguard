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

  if (Date.now() > Number(expiry) - 30_000) {
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

// --- Dev-only helpers (sessionStorage, tab-isolated) ---

const TEST_ACCESS_TOKEN_KEY = 'av_test_access_token';
const TEST_ACCESS_TOKEN_EXPIRY_KEY = 'av_test_access_token_expiry';

export async function loginForTesting(username: string): Promise<string> {
  const response = await fetch('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
    throw new AuthError(body.error ?? `Dev login fallito (${response.status})`);
  }

  const data: TelegramAuthResponse = await response.json();
  window.sessionStorage.setItem(TEST_ACCESS_TOKEN_KEY, data.accessToken);
  window.sessionStorage.setItem(
    TEST_ACCESS_TOKEN_EXPIRY_KEY,
    String(Date.now() + data.expiresIn * 1000)
  );
  return data.accessToken;
}

export function getStoredTestToken(): string | null {
  const token = window.sessionStorage.getItem(TEST_ACCESS_TOKEN_KEY);
  const expiry = window.sessionStorage.getItem(TEST_ACCESS_TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;

  if (Date.now() > Number(expiry) - 30_000) {
    window.sessionStorage.removeItem(TEST_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(TEST_ACCESS_TOKEN_EXPIRY_KEY);
    return null;
  }
  return token;
}
