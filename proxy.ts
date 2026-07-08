import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPublicOrigin } from "@/lib/public-origin";

// Next.js 16 "proxy" convention (formerly middleware).
export function proxy(request: NextRequest) {
  const session = request.cookies.get("session");
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/about" ||
    pathname === "/help" ||
    pathname === "/auth/callback";

  if (!session && !isPublic) {
    const origin = getPublicOrigin(request);
    return NextResponse.redirect(new URL("/login", origin));
  }

  return NextResponse.next();
}

// Run on all page routes except API routes, Next internals and static assets.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
