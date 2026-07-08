import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import Nav from "@/components/nav";
import MineClient from "./mine-client";
import type { Postcard } from "@/lib/types";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 21;

export default async function MinePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [claimedPage, claimedCount, uploadedCount] = await Promise.all([
    pool.query(
      `
      select p.*, cl.nickname as claimer_nickname
      from postcards p
      left join users cl on p.claimer_id = cl.id
      where p.claimer_id = $1
      order by p.claimed_at desc nulls last, p.created_at desc
      limit $2
      `,
      [user.id, DEFAULT_PAGE_SIZE]
    ),
    pool.query("select count(*)::int as count from postcards where claimer_id = $1", [
      user.id,
    ]),
    pool.query("select count(*)::int as count from postcards where uploader_id = $1", [
      user.id,
    ]),
  ]);

  return (
    <>
      <Nav />
      <main className="container py-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">我的明信片</h1>
        <MineClient
          initialClaimed={claimedPage.rows as Postcard[]}
          initialScopeCounts={{
            claimed: claimedCount.rows[0]?.count ?? 0,
            uploaded: uploadedCount.rows[0]?.count ?? 0,
          }}
          initialPageSize={DEFAULT_PAGE_SIZE}
          currentUserId={user.id}
        />
      </main>
    </>
  );
}
