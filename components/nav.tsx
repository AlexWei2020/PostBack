import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-xl">✉️</span>
          <span>PostBack</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            广场
          </Link>
          <Link
            href="/upload"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            上传
          </Link>
          <Link
            href="/mine"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            我的
          </Link>
          {user && (
            <div className="ml-2 flex items-center gap-2 border-l border-border pl-3">
              <span className="hidden text-muted-foreground sm:inline">
                {user.nickname || "已登录"}
              </span>
              <LogoutButton />
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
