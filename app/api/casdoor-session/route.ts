import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { pool } from "@/lib/db";

type CasdoorTokenResponse = {
  access_token?: string;
  accessToken?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

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

function hasName(info: CasdoorUserInfo | null): boolean {
  return Boolean(
    info?.name || info?.displayName || info?.preferred_username || info?.nickname
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body?.code || "");
    const codeVerifier = String(body?.codeVerifier || "");
    const redirectUri = String(body?.redirectUri || "");

    if (!code || !codeVerifier || !redirectUri) {
      return NextResponse.json(
        { error: "缺少 code / codeVerifier / redirectUri" },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID;
    const serverUrl = process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL;
    if (!clientId || !serverUrl) {
      return NextResponse.json(
        { error: "服务器缺少 Casdoor 配置（CLIENT_ID / SERVER_URL）" },
        { status: 500 }
      );
    }
    const base = serverUrl.replace(/\/+$/, "");

    // ── 1. Exchange the authorization code for an access token (server-side,
    //       so no browser CORS restrictions apply) ──────────────────────────
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
    // Casdoor accepts an optional client_secret for confidential clients; PKCE
    // public clients omit it. Include it only if configured.
    const clientSecret = process.env.CASDOOR_CLIENT_SECRET;
    if (clientSecret) tokenBody.set("client_secret", clientSecret);

    const tokenRes = await fetch(`${base}/api/login/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody,
    });
    const tokenText = await tokenRes.text();
    let tokenJson: CasdoorTokenResponse;
    try {
      tokenJson = JSON.parse(tokenText) as CasdoorTokenResponse;
    } catch {
      return NextResponse.json(
        { error: `换取 token 失败（HTTP ${tokenRes.status}）：${tokenText.slice(0, 300)}` },
        { status: 502 }
      );
    }
    const accessToken = tokenJson.access_token ?? tokenJson.accessToken;
    if (!tokenRes.ok || !accessToken) {
      return NextResponse.json(
        {
          error: `换取 token 失败（HTTP ${tokenRes.status}）：${
            tokenJson.error_description || tokenJson.error || "未知错误"
          }`,
        },
        { status: 401 }
      );
    }

    // ── 2. Fetch the user profile (server-side) ────────────────────────────
    const userInfoRes = await fetch(
      `${base}/api/userinfo?accessToken=${encodeURIComponent(accessToken)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    let userInfo: CasdoorUserInfo | null = userInfoRes.ok
      ? ((await userInfoRes.json()) as CasdoorUserInfo)
      : null;

    if (!hasName(userInfo)) {
      const fallbackRes = await fetch(
        `${base}/api/get-user?accessToken=${encodeURIComponent(accessToken)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (fallbackRes.ok) {
        userInfo = (await fallbackRes.json()) as CasdoorUserInfo;
      }
    }

    if (!userInfo) {
      return NextResponse.json({ error: "获取用户信息失败" }, { status: 502 });
    }

    const casdoorUser = normalizeCasdoorUser(userInfo);

    // ── 3. Upsert user + create local session ──────────────────────────────
    const user = await pool.query(
      `
      insert into users (geekpie_id, nickname, avatar_url)
      values ($1, $2, $3)
      on conflict (geekpie_id)
      do update set nickname = excluded.nickname, avatar_url = excluded.avatar_url
      returning *
      `,
      [casdoorUser.id, casdoorUser.name || null, casdoorUser.avatar || null]
    );

    const userId = user.rows[0].id;
    const sessionId = randomUUID();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const expiresIn = Number(tokenJson.expires_in);
    const casdoorExpiresAt = Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    await pool.query(
      `
      insert into sessions (id, user_id, expires_at, casdoor_access_token, casdoor_expires_at)
      values ($1, $2, $3, $4, $5)
      `,
      [sessionId, userId, expires, accessToken, casdoorExpiresAt]
    );

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
