-- PostBack schema & performance indexes (idempotent).
--
-- The app also applies all of this automatically on first request via
-- lib/schema.ts `ensureSchema()`, so pushing the code is enough to keep the site
-- working. Running this once by hand in the Supabase SQL editor is still
-- recommended right after deploy: it builds the indexes ahead of time so the
-- very first production request doesn't pay for the index creation, and lets you
-- optionally use CREATE INDEX CONCURRENTLY on a large, live table.
--
-- Safe to run multiple times — every statement is `if not exists` / `on conflict`.

-- Columns added incrementally as features shipped.
alter table public.postcards add column if not exists pickup_location text;
alter table public.postcards add column if not exists hidden_by_claimer boolean not null default false;
alter table public.postcards add column if not exists image_hash text;
alter table public.users     add column if not exists recipient_names text[] not null default '{}';

-- Indexes for the hot list/count queries.
--   广场 & 我的-上传:   order by created_at desc
--   状态筛选 & 计数:     where/ group by status
--   我的-认领:          where claimer_id  order by claimed_at desc
--   我的-上传:          where uploader_id order by created_at desc
--   去重:               where image_hash
--   广场默认视图:        created_at desc, 排除隐藏 (partial index)
create index if not exists postcards_created_at_idx on public.postcards (created_at desc);
create index if not exists postcards_status_idx     on public.postcards (status);
create index if not exists postcards_claimer_idx    on public.postcards (claimer_id, claimed_at desc);
create index if not exists postcards_uploader_idx   on public.postcards (uploader_id, created_at desc);
create index if not exists postcards_image_hash_idx on public.postcards (image_hash);
create index if not exists postcards_plaza_idx
  on public.postcards (created_at desc)
  where hidden_by_claimer is not true;

-- getCurrentUser() joins sessions -> users on every request.
create index if not exists sessions_user_id_idx on public.sessions (user_id);

-- Cumulative "已签收" counter (single-row table).
create table if not exists public.site_stats (
  id             smallint primary key default 1,
  total_received bigint not null default 0,
  constraint site_stats_singleton check (id = 1)
);
insert into public.site_stats (id, total_received)
select 1, (select count(*) from public.postcards where status = 'received')
on conflict (id) do nothing;
