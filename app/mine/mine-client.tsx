"use client";

import { useMemo, useState } from "react";
import PostcardCard from "@/components/postcard-card";
import PostcardDetail from "@/components/postcard-detail";
import type { Postcard } from "@/lib/types";

export default function MineClient({
  claimed,
  uploaded,
  currentUserId,
}: {
  claimed: Postcard[];
  uploaded: Postcard[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<"claimed" | "uploaded">("claimed");
  const [claimedList, setClaimedList] = useState<Postcard[]>(claimed);
  const [uploadedList, setUploadedList] = useState<Postcard[]>(uploaded);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const receive = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${id}/receive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "操作失败");
        return;
      }
      const patch = (list: Postcard[]) =>
        list.map((p) => (p.id === id ? { ...p, ...data.postcard } : p));
      setClaimedList(patch);
      setUploadedList(patch);
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
      const drop = (list: Postcard[]) => list.filter((p) => p.id !== id);
      setClaimedList(drop);
      setUploadedList(drop);
      setDetailId(null);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === "claimed" ? claimedList : uploadedList;

  const detail = useMemo(
    () =>
      [...claimedList, ...uploadedList].find((p) => p.id === detailId) ?? null,
    [claimedList, uploadedList, detailId]
  );

  return (
    <div>
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setTab("claimed")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            tab === "claimed"
              ? "bg-foreground text-background"
              : "bg-secondary text-secondary-foreground hover:opacity-80"
          }`}
        >
          我认领的 ({claimedList.length})
        </button>
        <button
          onClick={() => setTab("uploaded")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            tab === "uploaded"
              ? "bg-foreground text-background"
              : "bg-secondary text-secondary-foreground hover:opacity-80"
          }`}
        >
          我上传的 ({uploadedList.length})
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {tab === "claimed" ? "你还没有认领任何明信片。" : "你还没有上传任何明信片。"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <PostcardCard
              key={p.id}
              postcard={p}
              currentUserId={currentUserId}
              busy={busyId === p.id}
              onReceive={tab === "claimed" ? receive : undefined}
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
          onReceive={receive}
          onDelete={remove}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
