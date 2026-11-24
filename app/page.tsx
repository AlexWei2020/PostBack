import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getTotalReceived, ensureSchema } from "@/lib/schema";
import Nav from "@/components/nav";
import Icon from "@/components/icon";
import LoginButton from "@/components/login-button";
import { toGuestPostcard } from "@/lib/guest-postcard";
import HomeClient from "./home-client";
import type { Postcard, PostcardCounts } from "@/lib/types";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 21;

export default async function HomePage() {
  // Session lookup and the one-time schema/index check are independent — run
  // them together instead of serially.
  const [user, schema] = await Promise.all([getCurrentUser(), ensureSchema()]);
  // 未登录也可进入广场，但只下发照片和状态。
  const isGuest = !user;

  // 排除被认领人隐藏的明信片（广场对所有人不可见）。
  const listHidden = schema.hidden ? "where p.hidden_by_claimer is not true" : "";
  const countHidden = schema.hidden ? "where hidden_by_claimer is not true" : "";

  // Cumulative counter, plaza page, and status counts have no data dependency
  // on each other — fetch all three in parallel.
  const [totalReceived, result, countResult] = await Promise.all([
    getTotalReceived(),
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
      <main className="app-main">
        <div className="container">
        <div className="mb-6 pt-2">
          <h1 className="text-headline-medium text-on-surface">明信片广场</h1>
          {isGuest ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md bg-secondary-container px-4 py-3 text-on-secondary-container">
              <Icon name="lock" />
              <p className="min-w-0 flex-1 text-body-medium">
                当前未登录，仅显示明信片照片。登录后可查看收件人、取件地点等详细信息，并认领属于你的明信片。
              </p>
              <LoginButton label="登录" className="btn-filled" />
            </div>
          ) : (
            <p className="mt-2 text-body-medium text-on-surface-variant">
              网页右上角点击昵称，进入个人页面，配置常用收件名后可自动匹配 取到明信片后记得确认签收~
            </p>
          )}
          <p className="mt-4 inline-flex h-8 items-center gap-2 rounded-sm bg-tertiary-container px-3 text-label-large text-on-tertiary-container">
            <Icon name="markunread_mailbox" size={18} />
            已累计签收 <span className="tabular-nums">{totalReceived}</span> 张明信片
          </p>
        </div>
        <HomeClient
          initialPostcards={
            isGuest
              ? (result.rows as Postcard[]).map(toGuestPostcard)
              : (result.rows as Postcard[])
          }
          initialCounts={initialCounts}
          initialPageSize={DEFAULT_PAGE_SIZE}
          currentUserId={user?.id ?? null}
        />
        </div>
      </main>
    </>
  );
}
