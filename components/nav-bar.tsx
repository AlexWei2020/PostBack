"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import Icon, { type IconName } from "./icon";
import LinearProgress from "./linear-progress";
import LogoutButton from "./logout-button";

const NAV_ITEMS: { href: string; label: string; icon: IconName; activeIcon: IconName }[] = [
  { href: "/", label: "广场", icon: "home", activeIcon: "home_fill" },
  { href: "/upload", label: "上传", icon: "upload", activeIcon: "upload" },
  { href: "/mine", label: "我的", icon: "inbox", activeIcon: "inbox_fill" },
  { href: "/help", label: "帮助", icon: "help", activeIcon: "help_fill" },
  { href: "/about", label: "关于", icon: "info", activeIcon: "info_fill" },
];

// M3 布局：顶部应用栏 + 导航（≥640px 为左侧导航轨，窄屏为底部导航栏）。
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

  // 切换页面时立即反馈 + 顶部进度条，避免慢网络下重复点击。
  const navigate = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (href === pathname) return;
    startTransition(() => {
      router.push(href);
    });
  };

  const destination = (item: (typeof NAV_ITEMS)[number], variant: "rail" | "bar") => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={navigate(item.href)}
        aria-current={active ? "page" : undefined}
        className={`group flex flex-col items-center gap-1 text-label-medium ${
          variant === "rail" ? "w-20 py-1" : "flex-1 pb-4 pt-3"
        } ${active ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}
      >
        <span
          className={`state-layer flex h-8 items-center justify-center rounded-full ${
            variant === "rail" ? "w-14" : "w-16"
          } ${active ? "bg-secondary-container text-on-secondary-container" : ""}`}
        >
          <Icon name={active ? item.activeIcon : item.icon} />
        </span>
        {item.label}
      </Link>
    );
  };

  return (
    <>
      {isPending && <LinearProgress />}

      {/* 顶部应用栏（small）：高 64dp */}
      <header className="sticky top-0 z-20 bg-surface sm:pl-20">
        <div className="flex h-16 items-center gap-1 px-4">
          <Link href="/" onClick={navigate("/")} className="text-title-large text-on-surface">
            PostBack
          </Link>
          {loggedIn && (
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/account"
                onClick={navigate("/account")}
                aria-current={pathname === "/account" ? "page" : undefined}
                className={`state-layer flex h-10 max-w-40 items-center gap-2 rounded-full pl-2 pr-4 text-label-large ${
                  pathname === "/account"
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant"
                }`}
              >
                <Icon name="account_circle" />
                <span className="truncate">{nickname || "已登录"}</span>
              </Link>
              <LogoutButton />
            </div>
          )}
        </div>
      </header>

      {/* 导航轨：宽 80dp */}
      <nav
        aria-label="主导航"
        className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center gap-3 bg-surface pt-20 sm:flex"
      >
        {NAV_ITEMS.map((item) => destination(item, "rail"))}
      </nav>

      {/* 导航栏：窄屏底部，高 80dp */}
      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-30 flex bg-surface-container sm:hidden"
      >
        {NAV_ITEMS.map((item) => destination(item, "bar"))}
      </nav>
    </>
  );
}
