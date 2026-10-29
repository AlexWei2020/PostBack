import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getMineScopeCounts, getRecipientNameKeys, scopeQuery } from "@/lib/mine-scope";
import Nav from "@/components/nav";
import MineClient from "./mine-client";
import type { Postcard } from "@/lib/types";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 21;

export default async function MinePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const nameKeys = await getRecipientNameKeys(user.id);
  const q = scopeQuery("claimed", user.id, nameKeys);
  const [claimedPage, scopeCounts] = await Promise.all([
    pool.query(
      `
      select p.*, cl.nickname as claimer_nickname
      from postcards p
      left join users cl on p.claimer_id = cl.id
      where ${q.where}
      order by ${q.orderBy}
      limit $2
      `,
      [q.param, DEFAULT_PAGE_SIZE]
    ),
    getMineScopeCounts(user.id, nameKeys),
  ]);

  return (
    <>
      <Nav />
      <main className="app-main">
        <div className="container">
        <h1 className="mb-6 pt-2 text-headline-medium text-on-surface">我的明信片</h1>
        <MineClient
          initialClaimed={claimedPage.rows as Postcard[]}
          initialScopeCounts={scopeCounts}
          hasRecipientNames={nameKeys.length > 0}
          initialPageSize={DEFAULT_PAGE_SIZE}
          currentUserId={user.id}
        />
        </div>
      </main>
    </>
  );
}
