import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import NavBar from "./nav-bar";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex min-h-16 items-center gap-3 py-2">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
          <span className="text-xl">✉️</span>
          <span className="hidden sm:inline">PostBack</span>
        </Link>
        <NavBar loggedIn={!!user} nickname={user?.nickname ?? null} />
      </div>
    </header>
  );
}
