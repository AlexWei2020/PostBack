"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PostcardCard from "@/components/postcard-card";
import PostcardDetail from "@/components/postcard-detail";
import type { Postcard } from "@/lib/types";

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
  initialMatches,
  currentUserId,
}: {
  nickname: string;
  initialRecipientNames: string[];
  initialMatches: Postcard[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [namesText, setNamesText] = useState(initialRecipientNames.join("\n"));
  const [matches, setMatches] = useState<Postcard[]>(initialMatches);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  const detail = useMemo(
    () => matches.find((postcard) => postcard.id === detailId) ?? null,
    [matches, detailId]
  );

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
      setMessage("已保存，正在刷新匹配结果。");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  };

  const claim = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${id}/claim`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "认领失败");
        return;
      }
      setMatches((prev) => prev.filter((postcard) => postcard.id !== id));
      setDetailId(null);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
      <section>
        <div className="mb-4 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">当前登录</p>
          <p className="mt-1 font-semibold">{nickname}</p>
        </div>

        <form onSubmit={save} className="rounded-lg border border-border bg-card p-4">
          <label className="mb-2 block text-sm font-medium">常用收件名</label>
          <textarea
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            rows={8}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            可一行一个，也可用逗号分隔，最多保存 20 个。
          </p>

          {message && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "保存中…" : "保存收件名"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">疑似属于我的明信片</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            根据常用收件名匹配当前待认领记录。
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            暂无匹配的待认领明信片。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map((postcard) => (
              <PostcardCard
                key={postcard.id}
                postcard={postcard}
                currentUserId={currentUserId}
                busy={busyId === postcard.id}
                onClaim={claim}
                onOpen={setDetailId}
              />
            ))}
          </div>
        )}
      </section>

      {detail && (
        <PostcardDetail
          postcard={detail}
          currentUserId={currentUserId}
          busy={busyId === detail.id}
          onClaim={claim}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
