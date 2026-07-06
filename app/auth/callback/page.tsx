"use client";

import { useEffect, useState } from "react";

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

const CODE_VERIFIER_KEY = "pkce_verifier";
const STATE_KEY = "pkce_state";

export default function CasdoorCallback() {
  const [message, setMessage] = useState("处理中…");

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const expectedState = sessionStorage.getItem(STATE_KEY);
      const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);

      if (!code || !state || !verifier || !expectedState) {
        setMessage("参数缺失，请重新登录");
        return;
      }
      if (state !== expectedState) {
        setMessage("状态校验失败，请重新登录");
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID;
      const serverUrl = process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL;
      const redirectUri =
        process.env.NEXT_PUBLIC_CASDOOR_REDIRECT_URI ||
        `${window.location.origin}/auth/callback`;

      if (!clientId || !serverUrl) {
        setMessage("缺少 Casdoor 配置");
        return;
      }
      const base = serverUrl.replace(/\/+$/, "");

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
        // Most likely a CORS failure or network error hitting Casdoor directly
        // from the browser — this never reaches our own server, so it won't
        // show up in Vercel logs at all.
        console.error("[auth/callback] token fetch failed", err);
        setMessage(
          `无法连接 Casdoor（换取 token 时网络错误，可能是 CORS）：${
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
        console.error("[auth/callback] token response not JSON", tokenRes.status, tokenText);
        setMessage(`换取 token 失败（HTTP ${tokenRes.status}）：${tokenText.slice(0, 200)}`);
        return;
      }
      const accessToken = tokenJson.access_token ?? tokenJson.accessToken;

      if (!tokenRes.ok || !accessToken) {
        setMessage(
          `换取 token 失败（HTTP ${tokenRes.status}）：${
            tokenJson.error_description || tokenJson.error || "未知错误"
          }`
        );
        return;
      }

      let userInfoRes: Response;
      try {
        userInfoRes = await fetch(
          `${base}/api/userinfo?accessToken=${encodeURIComponent(accessToken)}`
        );
      } catch (err) {
        console.error("[auth/callback] userinfo fetch failed", err);
        setMessage(
          `获取用户信息网络错误：${err instanceof Error ? err.message : String(err)}`
        );
        return;
      }
      let userInfo: CasdoorUserInfo | null = userInfoRes.ok
        ? ((await userInfoRes.json()) as CasdoorUserInfo)
        : null;

      const hasName = (info: CasdoorUserInfo | null) =>
        Boolean(info?.name || info?.displayName || info?.preferred_username || info?.nickname);

      if (!hasName(userInfo)) {
        const fallbackRes = await fetch(
          `${base}/api/get-user?accessToken=${encodeURIComponent(accessToken)}`
        );
        if (fallbackRes.ok) {
          userInfo = (await fallbackRes.json()) as CasdoorUserInfo;
        }
      }

      if (!userInfo) {
        setMessage("获取用户信息失败");
        return;
      }

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
        setMessage(`创建会话失败（HTTP ${res.status}）：${data?.error || "未知错误"}`);
        return;
      }

      sessionStorage.removeItem(CODE_VERIFIER_KEY);
      sessionStorage.removeItem(STATE_KEY);
      window.location.assign("/");
    };

    run().catch((err) => {
      console.error("[auth/callback] unexpected error", err);
      setMessage(
        `登录失败，请重试（${err instanceof Error ? err.message : String(err)}）`
      );
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="max-w-xl break-words text-center text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
