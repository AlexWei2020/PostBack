export function getPublicOrigin(request: Request): string {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) {
    // Guard against a common misconfiguration: PUBLIC_BASE_URL set without a
    // scheme (e.g. "post.alexwei.top" instead of "https://post.alexwei.top").
    // `new URL(path, base)` throws ERR_INVALID_URL if base has no protocol,
    // which previously surfaced as a 500 on every request.
    const withScheme = /^https?:\/\//i.test(explicit) ? explicit : `https://${explicit}`;
    return withScheme.replace(/\/+$/, "");
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();

  if (forwardedProto && host) {
    return `${forwardedProto}://${host}`;
  }

  return new URL(request.url).origin;
}
