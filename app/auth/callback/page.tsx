"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { preconnect } from "react-dom";
import {
  clearPkceFallbackCookies,
  CODE_VERIFIER_KEY,
  readCookie,
  STATE_KEY,
} from "@/lib/pkce-storage";

type CasdoorTokenResponse = {
  access_token?: string;
  accessToken?: string;
  id_token?: string;
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

/**
 * Decode a JWT payload in the browser (no signature check — we only read the
 * username claims). Casdoor issues both the access_token and id_token as JWTs
 * whose payload already carries the user's id/name/avatar, so we can read the
 * profile straight out of the token and skip a separate /api/userinfo request
 * (which auth.geekpie.club blocks via CORS).
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userInfoFromJwt(token: string): CasdoorUserInfo | null {
  const p = decodeJwtPayload(token);
  if (!p) return null;
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const info: CasdoorUserInfo = {
    id: s(p.id) || s(p.sub) || s(p.userId),
    sub: s(p.sub),
    name: s(p.name),
    displayName: s(p.displayName),
    nickname: s(p.nickname),
    preferred_username: s(p.preferred_username),
    avatar: s(p.avatar) || s(p.picture),
  };
  const hasSomething = info.id || info.name || info.displayName || info.preferred_username;
  return hasSomething ? info : null;
}

function clearPkceState() {
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  clearPkceFallbackCookies();
}

const CASDOOR_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL || "").origin;
  } catch {
    return null;
  }
})();

export default function CasdoorCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("正在验证身份…");
  // 出错时停掉转圈，只显示错误信息。
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // 与下面向 Casdoor 换 token 并行：提前唤醒会话接口的冷启动和数据库连接。
    fetch("/api/casdoor-session", { cache: "no-store" }).catch(() => {});

    const fail = (text: string) => {
      setFailed(true);
      setMessage(text);
    };

    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const expectedState = sessionStorage.getItem(STATE_KEY) || readCookie(STATE_KEY);
      const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY) || readCookie(CODE_VERIFIER_KEY);

      if (!code || !state || !verifier || !expectedState) {
        fail("参数缺失，请重新登录");
        clearPkceState();
        return;
      }
      if (state !== expectedState) {
        fail("状态校验失败，请重新登录");
        clearPkceState();
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID;
      const serverUrl = process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL;
      const redirectUri =
        process.env.NEXT_PUBLIC_CASDOOR_REDIRECT_URI ||
        `${window.location.origin}/auth/callback`;

      if (!clientId || !serverUrl) {
        fail("缺少 Casdoor 配置");
        return;
      }
      const base = serverUrl.replace(/\/+$/, "");

      // ── Exchange the code for a token IN THE BROWSER. auth.geekpie.club is
      //    behind Cloudflare, which 403-challenges datacenter IPs (e.g. Vercel
      //    functions) but lets a real browser through — so this must stay
      //    client-side. ──────────────────────────────────────────────────────
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });

      let tokenRes: Response;
      try {
        tokenRes = await fetch(`${base}/api/login/oauth/access_token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body,
        });
      } catch (err) {
        fail(
          `无法连接 Casdoor（换取 token 网络错误）：${
            err instanceof Error ? err.message : String(err)
          }`
        );
        return;
      }

      const tokenText = await tokenRes.text();
      let tokenJson: CasdoorTokenResponse;
      try {
        tokenJson = JSON.parse(tokenText) as CasdoorTokenResponse;
      } catch {
        fail(`换取 token 失败（HTTP ${tokenRes.status}）：${tokenText.slice(0, 200)}`);
        return;
      }
      const accessToken = tokenJson.access_token ?? tokenJson.accessToken;
      if (!tokenRes.ok || !accessToken) {
        fail(
          `换取 token 失败（HTTP ${tokenRes.status}）：${
            tokenJson.error_description || tokenJson.error || "未知错误"
          }`
        );
        return;
      }

      // ── Get the username by decoding the JWT (id_token preferred, else the
      //    access_token). No network call, so no CORS problem. ────────────────
      let userInfo =
        (tokenJson.id_token && userInfoFromJwt(tokenJson.id_token)) ||
        userInfoFromJwt(accessToken);

      // Last-resort fallback: try the userinfo endpoint. Wrapped so a CORS
      // failure here doesn't break login when the JWT already gave us a name.
      if (!userInfo) {
        try {
          const uiRes = await fetch(
            `${base}/api/userinfo?accessToken=${encodeURIComponent(accessToken)}`
          );
          if (uiRes.ok) userInfo = (await uiRes.json()) as CasdoorUserInfo;
        } catch {
          /* ignore — handled below */
        }
      }

      if (!userInfo || !(userInfo.id || userInfo.sub)) {
        fail("无法从 token 解析用户信息");
        return;
      }

      setMessage("正在登录…");
      const res = await fetch("/api/casdoor-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          expiresIn: tokenJson.expires_in,
          userInfo,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        fail(data?.error || `创建会话失败（HTTP ${res.status}）`);
        return;
      }

      clearPkceState();
      setMessage("登录成功，正在进入广场…");
      // 客户端路由跳转：复用已加载的 JS 与布局，只请求首页数据，比整页刷新快。
      router.replace("/");
    };

    run().catch((err) => {
      console.error("[auth/callback] unexpected error", err);
      fail(
        `登录失败，请重试（${err instanceof Error ? err.message : String(err)}）`
      );
    });
  }, [router]);

  // 尽早与 Casdoor 建立连接（DNS/TLS），缩短换 token 请求的耗时。
  if (CASDOOR_ORIGIN) preconnect(CASDOOR_ORIGIN, { crossOrigin: "anonymous" });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
      {!failed && (
        <span className="h-12 w-12 animate-spin rounded-full border-4 border-secondary-container border-t-primary" />
      )}
      <p
        role="status"
        aria-live="polite"
        className="max-w-xl break-words text-center text-body-medium text-on-surface-variant"
      >
        {message}
      </p>
    </main>
  );
}
