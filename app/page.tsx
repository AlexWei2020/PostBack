import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import Nav from "@/components/nav";
import HomeClient from "./home-client";
import type { Postcard } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  // Middleware guarantees a session, but guard anyway.
  if (!user) return null;

  const result = await pool.query(
    `
    select
      p.*,
      up.nickname as uploader_nickname,
      cl.nickname as claimer_nickname
    from postcards p
    left join users up on p.uploader_id = up.id
    left join users cl on p.claimer_id = cl.id
    order by p.created_at desc
    `
  );

  return (
    <>
      <Nav />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">明信片广场</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            找到写着你名字的那张，点认领；收到实物后记得确认。
          </p>
        </div>
        <HomeClient
          initialPostcards={result.rows as Postcard[]}
          currentUserId={user.id}
        />
      </main>
    </>
  );
}
