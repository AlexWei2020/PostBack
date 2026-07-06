export const CODE_VERIFIER_KEY = "pkce_verifier";
export const STATE_KEY = "pkce_state";

export function writePkceFallbackCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=600; Path=/; SameSite=Lax; Secure`;
}

export function readCookie(name: string) {
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) return null;
  return decodeURIComponent(entry.slice(prefix.length));
}

export function clearPkceFallbackCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
}

export function clearPkceFallbackCookies() {
  clearPkceFallbackCookie(CODE_VERIFIER_KEY);
  clearPkceFallbackCookie(STATE_KEY);
}
