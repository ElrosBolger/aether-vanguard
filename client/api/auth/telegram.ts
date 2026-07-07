import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

const INIT_DATA_MAX_AGE_SECONDS = 86400;
const SESSION_TTL_SECONDS = 3600 * 6;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

function verifyTelegramInitData(initData: string, botToken: string): Map<string, string> | null {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;
  params.delete('hash');

  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const receivedBuf = Buffer.from(receivedHash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  if (receivedBuf.length !== computedBuf.length || !crypto.timingSafeEqual(receivedBuf, computedBuf)) {
    return null;
  }

  const authDate = Number(params.get('auth_date') ?? 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authDate || nowSeconds - authDate > INIT_DATA_MAX_AGE_SECONDS) {
    return null;
  }

  return new Map(params.entries());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { initData } = (req.body ?? {}) as { initData?: string };
  if (!initData || typeof initData !== 'string') {
    return res.status(400).json({ error: 'initData mancante o non valido' });
  }

  const verified = verifyTelegramInitData(initData, BOT_TOKEN);
  if (!verified) {
    return res.status(401).json({ error: 'Firma non valida o sessione scaduta' });
  }

  let telegramUser: TelegramUser;
  try {
    telegramUser = JSON.parse(verified.get('user') ?? '');
    if (!telegramUser?.id) throw new Error('missing id');
  } catch {
    return res.status(400).json({ error: 'Payload utente Telegram malformato' });
  }

  const { data: existingPlayer, error: selectError } = await supabaseAdmin
    .from('players')
    .select('id, is_banned')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle();

  if (selectError) {
    return res.status(500).json({ error: 'Errore di lettura database' });
  }

  if (existingPlayer?.is_banned) {
    return res.status(403).json({ error: 'Account sospeso' });
  }

  let playerId = existingPlayer?.id as string | undefined;

  if (!playerId) {
    const { data: newPlayer, error: insertError } = await supabaseAdmin
      .from('players')
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username ?? telegramUser.first_name ?? `Vanguard${telegramUser.id}`,
      })
      .select('id')
      .single();

    if (insertError || !newPlayer) {
      return res.status(500).json({ error: 'Impossibile creare il profilo giocatore' });
    }
    playerId = newPlayer.id;
  } else {
    await supabaseAdmin
      .from('players')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', playerId);
  }

  const sessionToken = jwt.sign(
    {
      sub: playerId,
      role: 'authenticated',
      telegram_id: telegramUser.id,
    },
    SUPABASE_JWT_SECRET,
    { expiresIn: SESSION_TTL_SECONDS }
  );

  return res.status(200).json({
    accessToken: sessionToken,
    expiresIn: SESSION_TTL_SECONDS,
    playerId,
  });
}
