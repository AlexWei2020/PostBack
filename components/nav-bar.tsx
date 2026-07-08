"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import LogoutButton from "./logout-button";

const NAV_ITEMS = [
  { href: "/", label: "广场" },
  { href: "/upload", label: "上传" },
  { href: "/mine", label: "我的" },
  { href: "/help", label: "帮助" },
  { href: "/about", label: "关于" },
];

export default function NavBar({
  loggedIn,
  nickname,
}: {
  loggedIn: boolean;
  nickname: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 顶部导航切换页面时，和"全部/待认领/…"筛选一样：立即反馈 + 顶部加载指示，
  // 避免用户在慢网络下点了没反应、又重复点击。
  const navigate = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (href === pathname) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  };

  const linkClass = (href: string) =>
    `shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 transition sm:px-3 ${
      pathname === href
        ? "bg-secondary font-medium text-foreground"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    }`;

  return (
    <nav
      className={`flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm transition-opacity ${
        isPending ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={navigate(item.href)}
          className={linkClass(item.href)}
        >
          {item.label}
        </Link>
      ))}

      {loggedIn && (
        <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-border pl-2 sm:pl-3">
          <Link
            href="/account"
            onClick={navigate("/account")}
            className={`block max-w-16 truncate rounded-md px-2 py-1.5 sm:max-w-28 ${
              pathname === "/account"
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {nickname || "已登录"}
          </Link>
          <LogoutButton />
        </div>
      )}

      {/* 醒目的加载指示：固定在视窗顶部居中，跟筛选切换保持一致的体验 */}
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/40 border-t-background" />
          加载中…
        </div>
      )}
    </nav>
  );
}
