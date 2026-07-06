"use client";

import { useState } from "react";

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
      className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
    >
      {loading ? "退出中…" : "退出"}
    </button>
  );
}
