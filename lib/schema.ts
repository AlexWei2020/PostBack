import { pool } from "@/lib/db";

let postcardMetadataReady = false;
let userRecipientNamesReady = false;
let postcardHiddenReady = false;
let siteStatsReady = false;

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
