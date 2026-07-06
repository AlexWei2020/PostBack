import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import Nav from "@/components/nav";
import MineClient from "./mine-client";
import type { Postcard } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MinePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [claimed, uploaded] = await Promise.all([
    pool.query(
      `
      select p.*, cl.nickname as claimer_nickname
      from postcards p
      left join users cl on p.claimer_id = cl.id
      where p.claimer_id = $1
      order by p.claimed_at desc nulls last, p.created_at desc
      `,
      [user.id]
    ),
    pool.query(
      `
      select p.*, cl.nickname as claimer_nickname
      from postcards p
      left join users cl on p.claimer_id = cl.id
      where p.uploader_id = $1
      order by p.created_at desc
      `,
      [user.id]
    ),
  ]);

  return (
    <>
      <Nav />
      <main className="container py-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">我的明信片</h1>
        <MineClient
          claimed={claimed.rows as Postcard[]}
          uploaded={uploaded.rows as Postcard[]}
          currentUserId={user.id}
        />
      </main>
    </>
  );
}
