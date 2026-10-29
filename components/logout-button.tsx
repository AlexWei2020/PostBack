"use client";

import { useState } from "react";
import Icon from "./icon";

// M3 标准图标按钮：40dp 圆形
export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    await fetch("/api/logout", { method: "POST" });
    window.location.assign("/login");
  };

  return (
    <button
      onClick={logout}
      disabled={loading}
      aria-label="退出登录"
      title="退出登录"
      className="state-layer grid h-10 w-10 place-items-center rounded-full text-on-surface-variant disabled:text-on-surface/[0.38]"
    >
      <Icon name="logout" />
    </button>
  );
}
