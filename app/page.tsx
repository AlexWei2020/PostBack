import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getTotalReceived, ensurePostcardHiddenColumn } from "@/lib/schema";
import Nav from "@/components/nav";
import HomeClient from "./home-client";
import type { Postcard, PostcardCounts } from "@/lib/types";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 21;

export default async function HomePage() {
  const user = await getCurrentUser();
  // Middleware guarantees a session, but guard anyway.
  if (!user) return null;

  const totalReceived = await getTotalReceived();

  // 排除被认领人隐藏的明信片（广场对所有人不可见）。
  const hiddenReady = await ensurePostcardHiddenColumn();
  const listHidden = hiddenReady ? "where p.hidden_by_claimer is not true" : "";
  const countHidden = hiddenReady ? "where hidden_by_claimer is not true" : "";

  const [result, countResult] = await Promise.all([
    pool.query(
      `
      select
        p.*,
        up.nickname as uploader_nickname,
        cl.nickname as claimer_nickname
      from postcards p
      left join users up on p.uploader_id = up.id
      left join users cl on p.claimer_id = cl.id
      ${listHidden}
      order by p.created_at desc
      limit $1
      `,
      [DEFAULT_PAGE_SIZE]
    ),
    pool.query(
      `select status, count(*)::int as count from postcards ${countHidden} group by status`
    ),
  ]);

  const initialCounts: PostcardCounts = {
    all: 0,
    available: 0,
    claimed: 0,
    received: 0,
  };
  for (const row of countResult.rows) {
    if (row.status in initialCounts) {
      initialCounts[row.status as keyof PostcardCounts] = row.count;
      initialCounts.all += row.count;
    }
  }

  return (
    <>
      <Nav />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">明信片广场</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ↗️网页右上角点击昵称，进入个人页面，配置常用收件名后可自动匹配 取到明信片后记得确认签收~
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            📮 已累计签收 <span className="tabular-nums">{totalReceived}</span> 张明信片
          </p>
        </div>
        <HomeClient
          initialPostcards={result.rows as Postcard[]}
          initialCounts={initialCounts}
          initialPageSize={DEFAULT_PAGE_SIZE}
          currentUserId={user.id}
        />
      </main>
    </>
  );
}
