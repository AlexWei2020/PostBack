import Nav from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureUserRecipientNamesColumn } from "@/lib/schema";
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

  return (
    <>
      <Nav />
      <main className="app-main">
        <div className="container max-w-xl">
        <div className="mb-6 pt-2">
          <h1 className="text-headline-medium text-on-surface">我的账户</h1>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            维护你的常用收件名，匹配到的待认领明信片会显示在“我的”页面的“疑似属于我的”中。
          </p>
        </div>
        <AccountClient
          nickname={user.nickname || "已登录"}
          initialRecipientNames={recipientNames}
        />
        </div>
      </main>
    </>
  );
}
