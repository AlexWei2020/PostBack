"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type MouseEvent } from "react";
import Icon, { type IconName } from "./icon";
import LinearProgress from "./linear-progress";
import LoginButton from "./login-button";
import LogoutButton from "./logout-button";

// requiresLogin：未登录时不在导航中显示（页面本身也会被 proxy 重定向到登录页）。
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  requiresLogin?: boolean;
}[] = [
  { href: "/", label: "广场", icon: "home", activeIcon: "home_fill" },
  { href: "/upload", label: "上传", icon: "upload", activeIcon: "upload", requiresLogin: true },
  { href: "/mine", label: "我的", icon: "inbox", activeIcon: "inbox_fill", requiresLogin: true },
  { href: "/help", label: "帮助", icon: "help", activeIcon: "help_fill" },
  { href: "/about", label: "关于", icon: "info", activeIcon: "info_fill" },
];

// M3 布局：顶部应用栏 + 导航（≥600px 为左侧导航轨，窄屏为底部导航栏）。
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

  const items = NAV_ITEMS.filter((item) => loggedIn || !item.requiresLogin);

  // M3 顶部应用栏：内容滚动后容器由 surface 变为 surface-container（on-scroll）。
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const destination = (item: (typeof NAV_ITEMS)[number], variant: "rail" | "bar") => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={navigate(item.href)}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-1 text-label-medium focus-visible:-outline-offset-4 ${
          variant === "rail" ? "w-full shrink-0 py-1" : "h-full min-w-0 flex-1 justify-center"
        } ${active ? "font-bold text-on-surface" : "text-on-surface-variant"}`}
      >
        <span
          className={`state-layer flex h-8 max-w-full items-center justify-center rounded-full transition-colors duration-200 ease-standard ${
            variant === "rail" ? "w-14" : "w-16"
          } ${active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"}`}
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
      <header
        className={`sticky top-0 z-20 transition-colors duration-200 ease-standard medium:pl-20 ${
          scrolled ? "bg-surface-container" : "bg-surface"
        }`}
      >
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
          {!loggedIn && (
            <div className="ml-auto">
              <LoginButton label="登录" className="btn-text" />
            </div>
          )}
        </div>
      </header>

      {/* 导航轨（md-comp-navigation-rail）：宽 80dp、surface、level0；顶部让出 64dp 应用栏 + 8dp */}
      <nav
        aria-label="主导航"
        className="fixed bottom-0 left-0 top-16 z-30 hidden w-20 flex-col items-center gap-3 overflow-y-auto bg-surface py-2 medium:flex"
      >
        {items.map((item) => destination(item, "rail"))}
      </nav>

      {/* 导航栏（md-comp-navigation-bar）：高 80dp、surface-container、level2 */}
      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(5rem+env(safe-area-inset-bottom))] bg-surface-container pb-[env(safe-area-inset-bottom)] shadow-elevation-2 medium:hidden"
      >
        {items.map((item) => destination(item, "bar"))}
      </nav>
    </>
  );
}
