import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex min-h-16 items-center gap-3 py-2">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
          <span className="text-xl">✉️</span>
          <span className="hidden sm:inline">PostBack</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-3"
          >
            广场
          </Link>
          <Link
            href="/upload"
            className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-3"
          >
            上传
          </Link>
          <Link
            href="/mine"
            className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-3"
          >
            我的
          </Link>
          <Link
            href="/about"
            className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-3"
          >
            关于
          </Link>
          {user && (
            <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-border pl-2 sm:pl-3">
              <Link
                href="/account"
                className="block max-w-16 truncate rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:max-w-28"
              >
                {user.nickname || "已登录"}
              </Link>
              <LogoutButton />
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
