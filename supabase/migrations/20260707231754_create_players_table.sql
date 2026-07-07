/*
# Create players table

## Summary
Stores one row per Telegram user who has logged in via the Mini App.
Created and updated exclusively by the Vercel Function (service role key,
bypasses RLS). The custom JWT (sub = players.id, role = 'authenticated',
signed with SUPABASE_JWT_SECRET) lets a logged-in client read its own row
via auth.uid() = id.

## New Table: players

| Column          | Type        | Notes                                  |
|-----------------|-------------|----------------------------------------|
| id              | uuid PK     | gen_random_uuid()                      |
| telegram_id     | bigint      | UNIQUE NOT NULL — Telegram user ID     |
| username        | text        | Display name (from Telegram profile)  |
| is_banned       | boolean     | Default false — checked on every login |
| last_login_at   | timestamptz | Updated each successful login          |
| created_at      | timestamptz | Set on first login                     |

## Security
- RLS enabled.
- SELECT: authenticated users can read their own row (auth.uid() = id).
  This works because the custom JWT carries sub = players.id and
  role = 'authenticated', so Supabase resolves auth.uid() correctly.
- INSERT / UPDATE / DELETE: no client policy — all writes go through the
  Vercel Function using the service role key, which bypasses RLS.

## Notes
1. telegram_id is bigint (Telegram IDs can exceed INT4 range).
2. is_banned is checked server-side in telegram.ts before issuing the JWT.
3. No foreign key to auth.users — auth is fully custom (Telegram HMAC).
*/

CREATE TABLE IF NOT EXISTS players (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id    bigint      UNIQUE NOT NULL,
  username       text        NOT NULL DEFAULT '',
  is_banned      boolean     NOT NULL DEFAULT false,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS players_telegram_id_idx ON players (telegram_id);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_player" ON players;
CREATE POLICY "select_own_player" ON players FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
