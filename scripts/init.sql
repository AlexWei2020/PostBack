-- PostBack schema — run once against your Neon/Postgres database.
-- psql "$DATABASE_URL" -f scripts/init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users authenticated via Casdoor (auth.geekpie.club).
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  geekpie_id  text NOT NULL UNIQUE,
  nickname    text,
  avatar_url  text,
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
  note           text,
  status         text NOT NULL DEFAULT 'available',
  uploader_id    uuid,
  claimer_id     uuid,
  sent_at        date,           -- 寄出时间（可选登记）
  arrived_at     date,           -- 到达时间 / 落地戳（可选登记）
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

CREATE INDEX IF NOT EXISTS postcards_status_idx     ON public.postcards (status, created_at DESC);
CREATE INDEX IF NOT EXISTS postcards_claimer_idx    ON public.postcards (claimer_id);
CREATE INDEX IF NOT EXISTS postcards_image_hash_idx ON public.postcards (image_hash);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx  ON public.sessions (expires_at);
