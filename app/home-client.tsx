"use client";

import { useMemo, useState } from "react";
import PostcardCard from "@/components/postcard-card";
import PostcardDetail from "@/components/postcard-detail";
import type { Postcard, PostcardStatus } from "@/lib/types";

type Filter = "all" | PostcardStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "available", label: "待认领" },
  { key: "claimed", label: "已认领" },
  { key: "received", label: "已收到" },
];

export default function HomeClient({
  initialPostcards,
  currentUserId,
}: {
  initialPostcards: Postcard[];
  currentUserId: string;
}) {
  const [postcards, setPostcards] = useState<Postcard[]>(initialPostcards);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? postcards : postcards.filter((p) => p.status === filter)),
    [postcards, filter]
  );

  const detail = useMemo(
    () => postcards.find((p) => p.id === detailId) ?? null,
    [postcards, detailId]
  );

  const act = async (id: string, path: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${id}/${path}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "操作失败");
        return;
      }
      setPostcards((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data.postcard } : p))
      );
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "删除失败");
        return;
      }
      setPostcards((prev) => prev.filter((p) => p.id !== id));
      setDetailId(null);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              filter === f.key
                ? "bg-foreground text-background"
                : "bg-secondary text-secondary-foreground hover:opacity-80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          这里还没有明信片。<a href="/upload" className="text-primary underline">上传第一张</a>吧！
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <PostcardCard
              key={p.id}
              postcard={p}
              currentUserId={currentUserId}
              busy={busyId === p.id}
              onClaim={(id) => act(id, "claim")}
              onReceive={(id) => act(id, "receive")}
              onOpen={setDetailId}
            />
          ))}
        </div>
      )}

      {detail && (
        <PostcardDetail
          postcard={detail}
          currentUserId={currentUserId}
          busy={busyId === detail.id}
          onClaim={(id) => act(id, "claim")}
          onReceive={(id) => act(id, "receive")}
          onDelete={remove}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
