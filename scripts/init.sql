-- PostBack schema — run once against your Neon/Postgres database.
-- psql "$DATABASE_URL" -f scripts/init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users authenticated via Casdoor (auth.geekpie.club).
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  geekpie_id  text NOT NULL UNIQUE,
  nickname    text,
  avatar_url  text,
  recipient_names text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Login sessions (opaque id stored in an httpOnly cookie).
CREATE TABLE IF NOT EXISTS public.sessions (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id               uuid,
  expires_at            timestamptz NOT NULL,
  casdoor_access_token  text,
  casdoor_expires_at    timestamptz,
  created_at            timestamptz DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Postcards uploaded to the site.
--   status: 'available' -> 'claimed' -> 'received'
CREATE TABLE IF NOT EXISTS public.postcards (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  image_url      text NOT NULL,
  recipient_name text NOT NULL,
  image_hash     text,
  pickup_location text,
  note           text,
  status         text NOT NULL DEFAULT 'available',
  uploader_id    uuid,
  claimer_id     uuid,
  sent_at        date,           -- 寄出时间（可选登记）
  arrived_at     date,           -- 到达时间 / 落地戳（可选登记）
  hidden_by_claimer boolean NOT NULL DEFAULT false,  -- 认领人隐藏后广场不可见
  created_at     timestamptz DEFAULT now(),
  claimed_at     timestamptz,
  received_at    timestamptz,
  CONSTRAINT postcards_pkey PRIMARY KEY (id),
  CONSTRAINT postcards_status_check CHECK (status IN ('available', 'claimed', 'received')),
  CONSTRAINT postcards_uploader_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT postcards_claimer_fkey  FOREIGN KEY (claimer_id)  REFERENCES public.users(id) ON DELETE SET NULL
);

-- Idempotent migration for existing databases (safe to run repeatedly).
ALTER TABLE public.postcards ADD COLUMN IF NOT EXISTS sent_at    date;
ALTER TABLE public.postcards ADD COLUMN IF NOT EXISTS arrived_at date;
ALTER TABLE public.postcards ADD COLUMN IF NOT EXISTS image_hash text;
ALTER TABLE public.postcards ADD COLUMN IF NOT EXISTS pickup_location text;
ALTER TABLE public.postcards ADD COLUMN IF NOT EXISTS hidden_by_claimer boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recipient_names text[] NOT NULL DEFAULT '{}';

-- 全站累计签收计数（单行表）。首次用当前 received 数量做基线。
CREATE TABLE IF NOT EXISTS public.site_stats (
  id             smallint PRIMARY KEY DEFAULT 1,
  total_received bigint NOT NULL DEFAULT 0,
  CONSTRAINT site_stats_singleton CHECK (id = 1)
);
INSERT INTO public.site_stats (id, total_received)
SELECT 1, (SELECT count(*) FROM public.postcards WHERE status = 'received')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS postcards_status_idx     ON public.postcards (status, created_at DESC);
CREATE INDEX IF NOT EXISTS postcards_hidden_idx      ON public.postcards (hidden_by_claimer);
CREATE INDEX IF NOT EXISTS postcards_claimer_idx    ON public.postcards (claimer_id);
CREATE INDEX IF NOT EXISTS postcards_image_hash_idx ON public.postcards (image_hash);
CREATE INDEX IF NOT EXISTS postcards_recipient_name_match_idx ON public.postcards ((lower(trim(recipient_name))));
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx  ON public.sessions (expires_at);
