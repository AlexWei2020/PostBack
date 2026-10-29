import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { pool } from "@/lib/db";

type CasdoorUserInfo = {
  id?: string;
  sub?: string;
  userId?: string;
  name?: string;
  displayName?: string;
  nickname?: string;
  preferred_username?: string;
  avatar?: string;
  avatarUrl?: string;
};

function normalizeCasdoorUser(info: CasdoorUserInfo) {
  const id = info.id || info.sub || info.userId;
  const name =
    info.name || info.displayName || info.preferred_username || info.nickname || "";
  const avatar = info.avatar || info.avatarUrl || "";
  if (!id) throw new Error("Casdoor user id missing");
  return { id, name, avatar };
}

// GET：预热。回调页一打开就调用，与浏览器向 Casdoor 换 token 并行进行，
// 让函数冷启动和数据库连接提前完成，后面的 POST 直接复用热连接。
export async function GET() {
  try {
    await pool.query("select 1");
  } catch {
    /* 预热失败不影响登录，POST 会再连一次 */
  }
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessToken = String(body?.accessToken || "");
    const expiresIn = Number(body?.expiresIn);
    const userInfo = body?.userInfo as CasdoorUserInfo | undefined;

    if (!accessToken || !userInfo) {
      return NextResponse.json({ error: "缺少 token 或用户信息" }, { status: 400 });
    }

    const casdoorUser = normalizeCasdoorUser(userInfo);

    const sessionId = randomUUID();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const casdoorExpiresAt = Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    // 用户 upsert 与会话写入合并为一条语句：只走一次数据库往返。
    const created = await pool.query(
      `
      with u as (
        insert into users (geekpie_id, nickname, avatar_url)
        values ($1, $2, $3)
        on conflict (geekpie_id)
        do update set nickname = excluded.nickname, avatar_url = excluded.avatar_url
        returning id
      )
      insert into sessions (id, user_id, expires_at, casdoor_access_token, casdoor_expires_at)
      select $4, u.id, $5, $6, $7 from u
      returning id
      `,
      [
        casdoorUser.id,
        casdoorUser.name || null,
        casdoorUser.avatar || null,
        sessionId,
        expires,
        accessToken,
        casdoorExpiresAt,
      ]
    );
    if (created.rowCount !== 1) throw new Error("session insert failed");

    const secureCookie =
      process.env.PUBLIC_BASE_URL?.startsWith("https://") ??
      process.env.NODE_ENV === "production";

    const response = NextResponse.json({ ok: true });
    response.cookies.set("session", sessionId, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      expires,
    });
    return response;
  } catch (error) {
    console.error("Casdoor session create failed:", error);
    return NextResponse.json(
      {
        error: "创建会话失败",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
