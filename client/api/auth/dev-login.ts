import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;
const SESSION_TTL_SECONDS = 3600 * 6;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (process.env.ALLOW_DEV_LOGIN !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = (req.body ?? {}) as { username?: string };
  const safeUsername = (username || `Tester${Date.now()}`).slice(0, 32);

  // Stable fake telegram_id for the same username — lets the same test
  // account reconnect across refreshes without creating duplicate rows.
  const fakeTelegramId = hashToPositiveInt(safeUsername);

  const { data: existingPlayer, error: selectError } = await supabaseAdmin
    .from('players')
    .select('id, is_banned')
    .eq('telegram_id', fakeTelegramId)
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
      .insert({ telegram_id: fakeTelegramId, username: safeUsername })
      .select('id')
      .single();

    if (insertError || !newPlayer) {
      return res.status(500).json({ error: 'Impossibile creare il profilo di test' });
    }
    playerId = newPlayer.id;
  }

  const sessionToken = jwt.sign(
    { sub: playerId, role: 'authenticated', telegram_id: fakeTelegramId },
    SUPABASE_JWT_SECRET,
    { expiresIn: SESSION_TTL_SECONDS }
  );

  return res.status(200).json({
    accessToken: sessionToken,
    expiresIn: SESSION_TTL_SECONDS,
    playerId,
  });
}

function hashToPositiveInt(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1_000_000_000;
}
