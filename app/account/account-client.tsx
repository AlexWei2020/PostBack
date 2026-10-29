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
        <div className="card-outlined mb-4 p-4">
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
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-md bg-error-container px-4 py-3 text-body-medium text-on-error-container">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-filled mt-4 w-full"
          >
            {busy ? "保存中…" : "保存收件名"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-title-large text-on-surface">疑似属于我的明信片</h2>
          <p className="mt-1 text-body-medium text-on-surface-variant">
            根据常用收件名匹配当前待认领记录。
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-md bg-surface-container-low py-16 text-center text-body-medium text-on-surface-variant">
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
