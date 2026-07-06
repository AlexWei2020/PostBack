"use client";

const CODE_VERIFIER_KEY = "pkce_verifier";
const STATE_KEY = "pkce_state";

function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length = 43) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join("");
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", data);
}

export default function LoginPage() {
  const handleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID;
    const serverUrl = process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL;
    const redirectUri =
      process.env.NEXT_PUBLIC_CASDOOR_REDIRECT_URI ||
      `${window.location.origin}/auth/callback`;
    const signinUrl =
      process.env.NEXT_PUBLIC_CASDOOR_SIGNIN_URL ||
      (serverUrl ? `${serverUrl.replace(/\/+$/, "")}/login/oauth/authorize` : "");
    const scope = process.env.NEXT_PUBLIC_CASDOOR_SCOPE || "openid profile email";

    if (!clientId || !signinUrl) {
      alert("缺少 Casdoor 配置，请检查环境变量。");
      return;
    }

    const state = randomString(32);
    const verifier = randomString(64);
    const challenge = base64UrlEncode(await sha256(verifier));

    sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    window.location.assign(`${signinUrl}?${params.toString()}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <div className="mb-4 text-5xl">✉️</div>
        <h1 className="text-3xl font-bold tracking-tight">PostBack</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          明信片认领互助站 —— 上传你手上的明信片，帮它找到主人；认领属于你的那一张。
        </p>
      </div>
      <button
        onClick={handleLogin}
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
      >
        通过 GeekPie 统一身份认证登录
      </button>
    </main>
  );
}
