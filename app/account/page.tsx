import Nav from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureUserRecipientNamesColumn } from "@/lib/schema";
import type { Postcard } from "@/lib/types";
import AccountClient from "./account-client";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canUseRecipientNames = await ensureUserRecipientNamesColumn();

  const profile = canUseRecipientNames
    ? await pool.query("select recipient_names from users where id = $1", [user.id])
    : { rows: [] };
  const recipientNames = (profile.rows[0]?.recipient_names ?? []) as string[];

  const matches =
    recipientNames.length > 0
      ? await pool.query(
          `
          select
            p.*,
            up.nickname as uploader_nickname,
            cl.nickname as claimer_nickname
          from postcards p
          left join users up on p.uploader_id = up.id
          left join users cl on p.claimer_id = cl.id
          where p.status = 'available'
            and p.claimer_id is null
            and lower(trim(p.recipient_name)) = any($1::text[])
          order by p.created_at desc
          `,
          [recipientNames.map((name) => name.trim().toLowerCase())]
        )
      : { rows: [] };

  return (
    <>
      <Nav />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">我的账户</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            维护你的常用收件名，系统会汇总可能属于你的待认领明信片。
          </p>
        </div>
        <AccountClient
          nickname={user.nickname || "已登录"}
          initialRecipientNames={recipientNames}
          initialMatches={matches.rows as Postcard[]}
          currentUserId={user.id}
        />
      </main>
    </>
  );
}
