"use client";

import Link from "next/link";
import { useState } from "react";

function parseNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，、]/)
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

export default function AccountClient({
  nickname,
  initialRecipientNames,
}: {
  nickname: string;
  initialRecipientNames: string[];
}) {
  const [namesText, setNamesText] = useState(initialRecipientNames.join("\n"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientNames: parseNames(namesText) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "保存失败");
        return;
      }
      setNamesText((data?.recipientNames || []).join("\n"));
      setMessage("已保存。");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card-outlined p-4">
        <p className="text-label-medium text-on-surface-variant">当前登录</p>
        <p className="mt-1 text-title-medium text-on-surface">{nickname}</p>
      </div>

      <form onSubmit={save} className="card-outlined p-4">
        <label className="field">
          <textarea
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            rows={8}
            className="field-input resize-none"
            placeholder=" "
          />
          <span className="field-label">常用收件名</span>
        </label>
        <p className="field-support">
          可一行一个，也可用逗号分隔，最多保存 20 个。
        </p>

        {message && (
          <p className="mt-3 rounded-md bg-success-container px-4 py-3 text-body-medium text-on-success-container">
            {message}
            <Link href="/mine" className="ml-2 text-primary underline">
              查看匹配结果
            </Link>
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-md bg-error-container px-4 py-3 text-body-medium text-on-error-container">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-filled mt-4 w-full">
          {busy ? "保存中…" : "保存收件名"}
        </button>
      </form>
    </div>
  );
}
