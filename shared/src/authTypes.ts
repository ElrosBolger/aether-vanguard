export interface SessionTokenPayload {
  sub: string;
  role: 'authenticated';
  telegram_id: number;
  iat?: number;
  exp?: number;
}
