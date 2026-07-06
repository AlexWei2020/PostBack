"use client";

import { useEffect, useState } from "react";

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

      const redirectUri =
        process.env.NEXT_PUBLIC_CASDOOR_REDIRECT_URI ||
        `${window.location.origin}/auth/callback`;

      // Hand the code + PKCE verifier to our own server, which performs the
      // token exchange and userinfo fetch server-to-server. Doing this in the
      // browser hits Casdoor cross-origin and gets blocked by CORS
      // ("Failed to fetch"), so it must run server-side.
      const res = await fetch("/api/casdoor-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, codeVerifier: verifier, redirectUri }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data?.error || `登录失败（HTTP ${res.status}）`);
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
