import { pool } from "@/lib/db";

let postcardMetadataReady = false;
let userRecipientNamesReady = false;
let postcardHiddenReady = false;
let siteStatsReady = false;

export type SchemaFlags = { metadata: boolean; hidden: boolean; hash: boolean };

// Consolidated, once-per-process schema check for the hot read paths
// (广场 / 我的 / 首屏). Batches every `add column if not exists`, the
// performance indexes, and the site_stats singleton into ONE round trip so a
// cold start pays a single query instead of 3–4 serial ones. Idempotent, so a
// fresh Supabase database is brought fully up to date on first request; an
// existing database just no-ops. Failure degrades gracefully via the returned
// flags, exactly like the granular helpers below.
let schemaFlags: SchemaFlags | null = null;
// 并发调用（如首页同时 ensureSchema + getTotalReceived）共享同一次检查。
let schemaPromise: Promise<SchemaFlags> | null = null;
export function ensureSchema(): Promise<SchemaFlags> {
  if (schemaFlags) return Promise.resolve(schemaFlags);
  if (!schemaPromise) {
    schemaPromise = runSchemaCheck().finally(() => {
      schemaPromise = null;
    });
  }
  return schemaPromise;
}

async function runSchemaCheck(): Promise<SchemaFlags> {
  try {
    await pool.query(`
      alter table public.postcards add column if not exists pickup_location text;
      alter table public.postcards add column if not exists hidden_by_claimer boolean not null default false;
      alter table public.postcards add column if not exists image_hash text;

      create index if not exists postcards_created_at_idx on public.postcards (created_at desc);
      create index if not exists postcards_status_idx on public.postcards (status);
      create index if not exists postcards_claimer_idx on public.postcards (claimer_id, claimed_at desc);
      create index if not exists postcards_uploader_idx on public.postcards (uploader_id, created_at desc);
      create index if not exists postcards_image_hash_idx on public.postcards (image_hash);
      create index if not exists postcards_plaza_idx
        on public.postcards (created_at desc)
        where hidden_by_claimer is not true;

      create table if not exists public.site_stats (
        id             smallint primary key default 1,
        total_received bigint not null default 0,
        constraint site_stats_singleton check (id = 1)
      );
      insert into public.site_stats (id, total_received)
      select 1, (select count(*) from public.postcards where status = 'received')
      on conflict (id) do nothing;
    `);
    // Everything above is now guaranteed; short-circuit the granular helpers.
    postcardMetadataReady = true;
    postcardHiddenReady = true;
    siteStatsReady = true;
    schemaFlags = { metadata: true, hidden: true, hash: true };
    return schemaFlags;
  } catch (err) {
    console.error("Failed to ensure schema:", err);
    return { metadata: false, hidden: false, hash: false };
  }
}

export async function ensurePostcardMetadataColumns() {
  if (postcardMetadataReady) return true;
  try {
    await pool.query("alter table public.postcards add column if not exists pickup_location text");
    postcardMetadataReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure postcard metadata columns:", err);
    return false;
  }
}

// 认领人「隐藏」标记：隐藏后从广场对所有人不可见，认领人仍能在「我的」看到。
export async function ensurePostcardHiddenColumn() {
  if (postcardHiddenReady) return true;
  try {
    await pool.query(
      "alter table public.postcards add column if not exists hidden_by_claimer boolean not null default false"
    );
    postcardHiddenReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure postcards.hidden_by_claimer column:", err);
    return false;
  }
}

// 全站累计签收计数（单行表）。首次用当前 received 数量做基线，之后只随
// 签收 +1 / 取消签收 -1 变化；删除记录不减（保护收件人隐私）。
export async function ensureSiteStats() {
  if (siteStatsReady) return true;
  // 优先走合并检查（一次往返，且与并发的 ensureSchema 共享）；失败再逐条兜底。
  if ((await ensureSchema()).metadata) return true;
  try {
    await pool.query(`
      create table if not exists public.site_stats (
        id             smallint primary key default 1,
        total_received bigint not null default 0,
        constraint site_stats_singleton check (id = 1)
      )
    `);
    await pool.query(`
      insert into public.site_stats (id, total_received)
      select 1, (select count(*) from public.postcards where status = 'received')
      on conflict (id) do nothing
    `);
    siteStatsReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure site_stats:", err);
    return false;
  }
}

// delta 通常是 +1 / -1；下限夹到 0。失败静默（不影响主流程）。
export async function bumpReceivedCount(delta: number) {
  if (!(await ensureSiteStats())) return;
  try {
    await pool.query(
      "update public.site_stats set total_received = greatest(0, total_received + $1) where id = 1",
      [delta]
    );
  } catch (err) {
    console.error("Failed to bump received count:", err);
  }
}

export async function getTotalReceived(): Promise<number> {
  try {
    if (!(await ensureSiteStats())) return 0;
    const r = await pool.query("select total_received from public.site_stats where id = 1");
    return Number(r.rows[0]?.total_received ?? 0);
  } catch (err) {
    console.error("Failed to read total_received:", err);
    return 0;
  }
}

export async function ensureUserRecipientNamesColumn() {
  if (userRecipientNamesReady) return true;
  try {
    await pool.query(
      "alter table public.users add column if not exists recipient_names text[] not null default '{}'"
    );
    userRecipientNamesReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure users.recipient_names column:", err);
    return false;
  }
}
