import { pool } from "@/lib/db";
import { ensureUserRecipientNamesColumn } from "@/lib/schema";

// "我的"页面的三个分类。
export type MineScope = "claimed" | "uploaded" | "matched";
export type MineScopeCounts = Record<MineScope, number>;

export function isMineScope(value: string | null): value is MineScope {
  return value === "claimed" || value === "uploaded" || value === "matched";
}

// 用户的常用收件名（小写、去首尾空格），用于"疑似属于我的"匹配。
export async function getRecipientNameKeys(userId: string): Promise<string[]> {
  if (!(await ensureUserRecipientNamesColumn())) return [];
  const { rows } = await pool.query("select recipient_names from users where id = $1", [userId]);
  const names = (rows[0]?.recipient_names ?? []) as string[];
  return names.map((name) => name.trim().toLowerCase()).filter(Boolean);
}

// 各分类的 where 条件（只用 $1）、对应参数与排序。
// 未使用的参数会让 Postgres 报"无法确定参数类型"，所以每个分类只绑定一个参数。
export function scopeQuery(scope: MineScope, userId: string, nameKeys: string[]) {
  if (scope === "matched") {
    return {
      where:
        "p.status = 'available' and p.claimer_id is null and lower(trim(p.recipient_name)) = any($1::text[])",
      param: nameKeys as unknown,
      orderBy: "p.created_at desc",
    };
  }
  return {
    where: `p.${scope === "claimed" ? "claimer_id" : "uploader_id"} = $1`,
    param: userId as unknown,
    orderBy:
      scope === "claimed" ? "p.claimed_at desc nulls last, p.created_at desc" : "p.created_at desc",
  };
}

export async function getMineScopeCounts(
  userId: string,
  nameKeys: string[]
): Promise<MineScopeCounts> {
  const { rows } = await pool.query(
    `
    select
      count(*) filter (where claimer_id = $1)::int as claimed,
      count(*) filter (where uploader_id = $1)::int as uploaded,
      count(*) filter (
        where status = 'available' and claimer_id is null
          and lower(trim(recipient_name)) = any($2::text[])
      )::int as matched
    from postcards
    `,
    [userId, nameKeys]
  );
  return {
    claimed: rows[0]?.claimed ?? 0,
    uploaded: rows[0]?.uploaded ?? 0,
    matched: rows[0]?.matched ?? 0,
  };
}
