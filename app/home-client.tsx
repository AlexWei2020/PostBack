"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PostcardCard from "@/components/postcard-card";
import PostcardDetail from "@/components/postcard-detail";
import LoadMoreFooter from "@/components/load-more-footer";
import LinearProgress from "@/components/linear-progress";
import Icon from "@/components/icon";
import { useLoadMoreSentinel } from "@/lib/use-load-more";
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

// 后台对齐一次最多重拉的张数，与接口 pageSize 上限一致。
const MAX_SYNC_SIZE = 200;

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
  // 每批加载张数（首屏由服务端渲染同样数量）。
  const BATCH_SIZE = initialPageSize;
  // 切换板块时整表重载（变灰 + 顶部提示）。
  const [loadingPage, setLoadingPage] = useState(false);
  // 翻到底自动追加下一批。
  const [loadingMore, setLoadingMore] = useState(false);
  // 乐观操作后的后台对齐进行中；期间暂停追加，避免两次写入互相覆盖。
  const [syncing, setSyncing] = useState(false);
  // 追加失败后停止自动加载，改为显示"重试"，避免无限重试刷请求。
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // 点击筛选后立即高亮（乐观），无需等待请求返回。
  const [pendingFilter, setPendingFilter] = useState<PostcardFilter | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // 每次发起整表请求都递增；过期的追加结果直接丢弃（如加载途中切换了板块）。
  const requestSeq = useRef(0);
  const activeFilter = pendingFilter ?? filter;

  const total = counts[filter];
  const hasMore = postcards.length < total;

  const detail = useMemo(
    () => postcards.find((p) => p.id === detailId) ?? null,
    [postcards, detailId],
  );

  // 后台对齐时需要知道"现在已加载多少张"，而回调可能来自旧的渲染闭包。
  const loadedCountRef = useRef(postcards.length);
  useEffect(() => {
    loadedCountRef.current = postcards.length;
  }, [postcards.length]);

  const fetchList = async (f: PostcardFilter, offset: number, limit: number) => {
    const params = new URLSearchParams({
      offset: String(offset),
      pageSize: String(limit),
    });
    if (f !== "all") params.set("status", f);
    const res = await fetch(`/api/postcards?${params.toString()}`);
    const data = (await res.json().catch(() => ({}))) as PostcardsPageResponse;
    return { ok: res.ok, data };
  };

  // 从头重新加载列表。
  // silent: 乐观操作后的后台对齐——重新拉取已加载的整段，不变灰、不跳顶部。
  const reload = async ({
    nextFilter = filter,
    silent = false,
  }: { nextFilter?: PostcardFilter; silent?: boolean } = {}) => {
    const seq = ++requestSeq.current;
    // 新请求会作废旧请求，所以两个标记都按本次请求重新设置。
    setSyncing(silent);
    setLoadingPage(!silent);
    setLoadingMore(false);
    setError(null);
    setLoadMoreFailed(false);
    const limit = silent
      ? Math.min(MAX_SYNC_SIZE, Math.max(BATCH_SIZE, loadedCountRef.current))
      : BATCH_SIZE;
    try {
      const { ok, data } = await fetchList(nextFilter, 0, limit);
      if (seq !== requestSeq.current) return;
      if (!ok) {
        setError(data?.error || "加载失败");
        return;
      }
      setFilter(nextFilter);
      setCounts(data.counts || counts);
      setPostcards(data.postcards || []);
      // 换板块后把列表顶部滚回视野；静默对齐（认领后）不打断滚动。
      if (!silent) {
        requestAnimationFrame(() =>
          gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    } catch {
      if (seq === requestSeq.current && !silent) setError("网络错误，请重试");
    } finally {
      if (seq === requestSeq.current) {
        setSyncing(false);
        setLoadingPage(false);
        setPendingFilter(null);
      }
    }
  };

  // 翻到底：从已加载张数处续拉下一批，追加到列表末尾。
  const loadMore = async () => {
    if (loadingMore || loadingPage || syncing || !hasMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const { ok, data } = await fetchList(filter, postcards.length, BATCH_SIZE);
      if (seq !== requestSeq.current) return;
      if (!ok) {
        setLoadMoreFailed(true);
        return;
      }
      const batch = data.postcards || [];
      if (data.counts) setCounts(data.counts);
      // 期间有新上传会让 offset 错位，按 id 去重防止同一张出现两次。
      setPostcards((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...batch.filter((p) => !seen.has(p.id))];
      });
      // 服务器已无更多数据时，以实际数量为准，停止继续加载。
      if (batch.length < BATCH_SIZE) {
        const loaded = postcards.length + batch.length;
        setCounts((c) => (c[filter] > loaded ? { ...c, [filter]: loaded } : c));
      }
    } catch {
      if (seq === requestSeq.current) setLoadMoreFailed(true);
    } finally {
      if (seq === requestSeq.current) setLoadingMore(false);
    }
  };

  const sentinelRef = useLoadMoreSentinel(
    () => loadMore(),
    hasMore && !loadingPage && !loadingMore && !syncing && !loadMoreFailed,
  );

  // 认领/签收/取消：先本地即时改状态（乐观），再后台静默与服务器对齐。
  // 让点击"秒响应"，不再整格变灰、跳回顶部。
  const optimisticStatus: Record<string, (p: Postcard) => Partial<Postcard>> = {
    "claim:POST": () => ({ status: "claimed", claimer_id: currentUserId }),
    "receive:POST": () => ({ status: "received" }),
    "claim:DELETE": () => ({ status: "available", claimer_id: null }),
    "receive:DELETE": () => ({ status: "claimed" }),
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
    const patch = optimisticStatus[`${path}:${method}`];
    if (patch) {
      setPostcards((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch(p) } : p)),
      );
    }
    try {
      const res = await fetch(`/api/postcards/${id}/${path}`, { method });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "操作失败");
      } else {
        setDetailId(null);
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
      // 后台对齐：修正计数、分页归属，成功/失败都以服务器为准。
      reload({ silent: true });
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setError(null);
    // 乐观移除，弹窗立即关闭。
    setPostcards((prev) => prev.filter((p) => p.id !== id));
    setDetailId(null);
    try {
      const res = await fetch(`/api/postcards/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || "删除失败");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
      reload({ silent: true });
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
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            disabled={loadingPage}
            onClick={() => {
              if (activeFilter === f.key && !loadingPage) return;
              setPendingFilter(f.key);
              reload({ nextFilter: f.key });
            }}
            aria-pressed={activeFilter === f.key}
            className={`chip disabled:cursor-wait ${activeFilter === f.key ? "chip-selected" : ""}`}
          >
            {activeFilter === f.key && <Icon name="check" size={18} />}
            {f.label}（{counts[f.key]}张）
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-error-container px-4 py-3 text-body-medium text-on-error-container">
          {error}
        </p>
      )}

      <div ref={gridRef} className="relative scroll-mt-20">
        {total === 0 ? (
          <div className="rounded-md bg-surface-container-low py-16 text-center text-body-medium text-on-surface-variant">
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
            {postcards.map((p, index) => (
              <PostcardCard
                key={p.id}
                postcard={p}
                currentUserId={currentUserId}
                busy={busyId === p.id}
                priority={index < 3}
                onClaim={(id) => act(id, "claim")}
                onReceive={(id) => act(id, "receive")}
                onCancelClaim={(id) => actWithMethod(id, "claim", "DELETE")}
                onCancelReceive={(id) => actWithMethod(id, "receive", "DELETE")}
                onOpen={setDetailId}
              />
            ))}
          </div>
        )}

        {/* 切换筛选时在视窗顶部显示 M3 线性进度条 */}
        {loadingPage && <LinearProgress />}
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
      {total > 0 && (
        <LoadMoreFooter
          sentinelRef={sentinelRef}
          loaded={postcards.length}
          total={total}
          hasMore={hasMore}
          loadingMore={loadingMore}
          failed={loadMoreFailed}
          onRetry={loadMore}
        />
      )}
    </div>
  );
}
