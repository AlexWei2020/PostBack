import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import Nav from "@/components/nav";
import HomeClient from "./home-client";
import type { Postcard, PostcardCounts } from "@/lib/types";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 20;

export default async function HomePage() {
  const user = await getCurrentUser();
  // Middleware guarantees a session, but guard anyway.
  if (!user) return null;

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
      order by p.created_at desc
      limit $1
      `,
      [DEFAULT_PAGE_SIZE]
    ),
    pool.query("select status, count(*)::int as count from postcards group by status"),
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
