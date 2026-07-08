"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PostcardCard from "@/components/postcard-card";
import PostcardDetail from "@/components/postcard-detail";
import type {
  Postcard,
  PostcardCounts,
  PostcardFilter,
  PostcardUpdateInput,
} from "@/lib/types";

const FILTERS: { key: PostcardFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "available", label: "待认领" },
  { key: "claimed", label: "已认领" },
  { key: "received", label: "已收到" },
];

type PostcardsPageResponse = {
  postcards?: Postcard[];
  counts?: PostcardCounts;
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
  error?: string;
};

export default function HomeClient({
  initialPostcards,
  initialCounts,
  initialPageSize,
  currentUserId,
}: {
  initialPostcards: Postcard[];
  initialCounts: PostcardCounts;
  initialPageSize: number;
  currentUserId: string;
}) {
  const [postcards, setPostcards] = useState<Postcard[]>(initialPostcards);
  const [counts, setCounts] = useState<PostcardCounts>(initialCounts);
  const [filter, setFilter] = useState<PostcardFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [loadingPage, setLoadingPage] = useState(false);
  // 点击筛选后立即高亮（乐观），无需等待请求返回。
  const [pendingFilter, setPendingFilter] = useState<PostcardFilter | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const activeFilter = pendingFilter ?? filter;

  const total = counts[filter];
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + postcards.length, total);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const detail = useMemo(
    () => postcards.find((p) => p.id === detailId) ?? null,
    [postcards, detailId],
  );

  const loadPage = async ({
    nextFilter = filter,
    nextPage = currentPage,
    nextPageSize = pageSize,
  }: {
    nextFilter?: PostcardFilter;
    nextPage?: number;
    nextPageSize?: number;
  } = {}) => {
    setLoadingPage(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
      });
      if (nextFilter !== "all") params.set("status", nextFilter);

      const res = await fetch(`/api/postcards?${params.toString()}`);
      const data = (await res
        .json()
        .catch(() => ({}))) as PostcardsPageResponse;
      if (!res.ok) {
        setError(data?.error || "加载失败");
        return;
      }

      const nextCounts = data.counts || counts;
      const nextTotal = nextCounts[nextFilter];
      const nextPageCount = Math.max(1, Math.ceil(nextTotal / nextPageSize));
      const safePage = Math.min(nextPage, nextPageCount);
      if (safePage !== nextPage) {
        await loadPage({ nextFilter, nextPage: safePage, nextPageSize });
        return;
      }

      setFilter(nextFilter);
      setPageSize(nextPageSize);
      setPage(safePage);
      setCounts(nextCounts);
      setPostcards(data.postcards || []);
      // 换页/换板块后把列表顶部滚回视野，避免停在旧的滚动位置。
      requestAnimationFrame(() =>
        gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoadingPage(false);
      setPendingFilter(null);
    }
  };

  const act = async (id: string, path: string) => {
    await actWithMethod(id, path, "POST");
  };

  const actWithMethod = async (
    id: string,
    path: string,
    method: "POST" | "DELETE",
  ) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${id}/${path}`, { method });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "操作失败");
        return;
      }
      setDetailId(null);
      await loadPage();
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
      setDetailId(null);
      await loadPage();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
    }
  };

  const update = async (id: string, input: PostcardUpdateInput) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "保存失败");
        return false;
      }
      setPostcards((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data.postcard } : p)),
      );
      return true;
    } catch {
      setError("网络错误，请重试");
      return false;
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
            disabled={loadingPage}
            onClick={() => {
              if (activeFilter === f.key && !loadingPage) return;
              setPendingFilter(f.key);
              loadPage({ nextFilter: f.key, nextPage: 1 });
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm transition disabled:cursor-wait ${
              activeFilter === f.key
                ? "bg-foreground text-background"
                : "bg-secondary text-secondary-foreground hover:opacity-80"
            }`}
          >
            {f.label}（{counts[f.key]}张）
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div ref={gridRef} className="relative scroll-mt-20">
        {total === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            这里还没有明信片。
            <a href="/upload" className="text-primary underline">
              上传第一张
            </a>
            吧！
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${
              loadingPage ? "pointer-events-none opacity-40" : ""
            }`}
          >
            {postcards.map((p) => (
              <PostcardCard
                key={p.id}
                postcard={p}
                currentUserId={currentUserId}
                busy={busyId === p.id}
                onClaim={(id) => act(id, "claim")}
                onReceive={(id) => act(id, "receive")}
                onCancelClaim={(id) => actWithMethod(id, "claim", "DELETE")}
                onCancelReceive={(id) => actWithMethod(id, "receive", "DELETE")}
                onOpen={setDetailId}
              />
            ))}
          </div>
        )}

        {/* 醒目的加载指示：固定在视窗顶部居中，无论滚动到哪都能看见 */}
        {loadingPage && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/40 border-t-background" />
            加载中…
          </div>
        )}
      </div>

      {detail && (
        <PostcardDetail
          postcard={detail}
          currentUserId={currentUserId}
          busy={busyId === detail.id}
          onClaim={(id) => act(id, "claim")}
          onReceive={(id) => act(id, "receive")}
          onCancelClaim={(id) => actWithMethod(id, "claim", "DELETE")}
          onCancelReceive={(id) => actWithMethod(id, "receive", "DELETE")}
          onHide={(id) => actWithMethod(id, "hide", "POST")}
          onUnhide={(id) => actWithMethod(id, "hide", "DELETE")}
          onUpdate={update}
          onDelete={remove}
          onClose={() => setDetailId(null)}
        />
      )}
      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          显示第 {total === 0 ? 0 : pageStart + 1}-{pageEnd} 张，共 {total} 张
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="上一页"
              onClick={() =>
                loadPage({ nextPage: Math.max(1, currentPage - 1) })
              }
              disabled={currentPage <= 1 || loadingPage}
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-lg leading-none text-foreground transition hover:border-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
            >
              ‹
            </button>
            <span className="min-w-16 text-center font-medium text-foreground">
              {currentPage}/{pageCount}
            </span>
            <button
              type="button"
              aria-label="下一页"
              onClick={() =>
                loadPage({ nextPage: Math.min(pageCount, currentPage + 1) })
              }
              disabled={currentPage >= pageCount || loadingPage}
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-lg leading-none text-foreground transition hover:border-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
            >
              ›
            </button>
          </div>
          <label className="flex items-center gap-2">
            <span>每页</span>
            <input
              type="number"
              min={1}
              max={100}
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                loadPage({
                  nextPage: 1,
                  nextPageSize: Math.min(100, Math.max(1, Math.floor(next))),
                });
              }}
              className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-base text-foreground outline-none ring-ring focus:ring-2 sm:text-sm"
            />
            <span>张</span>
          </label>
        </div>
      </div>
    </div>
  );
}
