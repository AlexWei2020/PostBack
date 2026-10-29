"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PostcardCard from "@/components/postcard-card";
import PostcardDetail from "@/components/postcard-detail";
import LoadMoreFooter from "@/components/load-more-footer";
import LinearProgress from "@/components/linear-progress";
import Icon from "@/components/icon";
import { useLoadMoreSentinel } from "@/lib/use-load-more";
import type { MineScope, MineScopeCounts } from "@/lib/mine-scope";
import type { Postcard, PostcardUpdateInput } from "@/lib/types";

type Scope = MineScope;
type ScopeCounts = MineScopeCounts;

const TABS: { key: Scope; label: string }[] = [
  { key: "claimed", label: "我认领的" },
  { key: "uploaded", label: "我上传的" },
  { key: "matched", label: "疑似属于我的" },
];

const EMPTY_TEXT: Record<Scope, string> = {
  claimed: "你还没有认领任何明信片。",
  uploaded: "你还没有上传任何明信片。",
  matched: "暂无匹配的待认领明信片。",
};

// 后台对齐一次最多重拉的张数，与接口 pageSize 上限一致。
const MAX_SYNC_SIZE = 200;

type PostcardsPageResponse = {
  postcards?: Postcard[];
  scopeCounts?: ScopeCounts;
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
  error?: string;
};

export default function MineClient({
  initialClaimed,
  initialScopeCounts,
  hasRecipientNames,
  initialPageSize,
  currentUserId,
}: {
  initialClaimed: Postcard[];
  initialScopeCounts: ScopeCounts;
  hasRecipientNames: boolean;
  initialPageSize: number;
  currentUserId: string;
}) {
  const [scope, setScope] = useState<Scope>("claimed");
  const [postcards, setPostcards] = useState<Postcard[]>(initialClaimed);
  const [scopeCounts, setScopeCounts] = useState<ScopeCounts>(initialScopeCounts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // 每批加载张数（首屏由服务端渲染同样数量）。
  const BATCH_SIZE = initialPageSize;
  // 切换 tab 时整表重载（变灰 + 顶部提示）。
  const [loadingPage, setLoadingPage] = useState(false);
  // 翻到底自动追加下一批。
  const [loadingMore, setLoadingMore] = useState(false);
  // 乐观操作后的后台对齐进行中；期间暂停追加，避免两次写入互相覆盖。
  const [syncing, setSyncing] = useState(false);
  // 追加失败后停止自动加载，改为显示"重试"，避免无限重试刷请求。
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // 切换 tab 后立即高亮（乐观），无需等待请求返回，和广场筛选一致。
  const [pendingScope, setPendingScope] = useState<Scope | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // 每次发起整表请求都递增；过期的追加结果直接丢弃（如加载途中切换了 tab）。
  const requestSeq = useRef(0);
  const activeScope = pendingScope ?? scope;

  const total = scopeCounts[scope];
  const hasMore = postcards.length < total;

  // 后台对齐时需要知道"现在已加载多少张"，而回调可能来自旧的渲染闭包。
  const loadedCountRef = useRef(postcards.length);
  useEffect(() => {
    loadedCountRef.current = postcards.length;
  }, [postcards.length]);

  const detail = useMemo(
    () => postcards.find((p) => p.id === detailId) ?? null,
    [postcards, detailId],
  );

  const fetchList = async (s: Scope, offset: number, limit: number) => {
    const params = new URLSearchParams({
      scope: s,
      offset: String(offset),
      pageSize: String(limit),
    });
    const res = await fetch(`/api/postcards?${params.toString()}`);
    const data = (await res.json().catch(() => ({}))) as PostcardsPageResponse;
    return { ok: res.ok, data };
  };

  // 从头重新加载列表。
  // silent: 乐观操作后的后台对齐——重新拉取已加载的整段，不变灰、不跳顶部。
  const reload = async ({
    nextScope = scope,
    silent = false,
  }: { nextScope?: Scope; silent?: boolean } = {}) => {
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
      const { ok, data } = await fetchList(nextScope, 0, limit);
      if (seq !== requestSeq.current) return;
      if (!ok) {
        setError(data?.error || "加载失败");
        return;
      }
      setScope(nextScope);
      setScopeCounts(data.scopeCounts || scopeCounts);
      setPostcards(data.postcards || []);
      // 换 tab 后把列表顶部滚回视野；静默对齐不打断滚动。
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
        setPendingScope(null);
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
      const { ok, data } = await fetchList(scope, postcards.length, BATCH_SIZE);
      if (seq !== requestSeq.current) return;
      if (!ok) {
        setLoadMoreFailed(true);
        return;
      }
      const batch = data.postcards || [];
      if (data.scopeCounts) setScopeCounts(data.scopeCounts);
      // 期间有新数据会让 offset 错位，按 id 去重防止同一张出现两次。
      setPostcards((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...batch.filter((p) => !seen.has(p.id))];
      });
      // 服务器已无更多数据时，以实际数量为准，停止继续加载。
      if (batch.length < BATCH_SIZE) {
        const loaded = postcards.length + batch.length;
        setScopeCounts((c) => (c[scope] > loaded ? { ...c, [scope]: loaded } : c));
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

  // "疑似属于我的"里认领：先从列表移除（认领后不再属于该分类），计数同步调整。
  const claim = async (id: string) => {
    setBusyId(id);
    setError(null);
    setPostcards((list) => list.filter((p) => p.id !== id));
    setScopeCounts((c) => ({ ...c, matched: Math.max(0, c.matched - 1), claimed: c.claimed + 1 }));
    setDetailId(null);
    try {
      const res = await fetch(`/api/postcards/${id}/claim`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || "认领失败");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
      reload({ silent: true });
    }
  };

  const receive = async (id: string) => {
    await receiveWithMethod(id, "POST");
  };

  const receiveWithMethod = async (id: string, method: "POST" | "DELETE") => {
    setBusyId(id);
    setError(null);
    // 乐观改状态：确认签收 -> received，取消签收 -> claimed。
    const nextStatus = method === "POST" ? "received" : "claimed";
    setPostcards((list) =>
      list.map((p) => (p.id === id ? { ...p, status: nextStatus } : p)),
    );
    try {
      const res = await fetch(`/api/postcards/${id}/receive`, { method });
      const data = await res.json();
      if (!res.ok) setError(data?.error || "操作失败");
      else setDetailId(null);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
      reload({ silent: true });
    }
  };

  const cancelClaim = async (id: string) => {
    setBusyId(id);
    setError(null);
    // 取消认领后会离开"我认领的"列表，先本地移除。
    setPostcards((list) => list.filter((p) => p.id !== id));
    setDetailId(null);
    try {
      const res = await fetch(`/api/postcards/${id}/claim`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || "取消认领失败");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusyId(null);
      reload({ silent: true });
    }
  };

  const toggleHide = async (id: string, hidden: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${id}/hide`, {
        method: hidden ? "POST" : "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || (hidden ? "隐藏失败" : "取消隐藏失败"));
        return;
      }
      setPostcards((list) =>
        list.map((p) => (p.id === id ? { ...p, ...data.postcard } : p)),
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
    setPostcards((list) => list.filter((p) => p.id !== id));
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
      setPostcards((list) =>
        list.map((p) => (p.id === id ? { ...p, ...data.postcard } : p)),
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
        {TABS.map((t) => (
          <button
            key={t.key}
            disabled={loadingPage}
            onClick={() => {
              if (activeScope === t.key && !loadingPage) return;
              setPendingScope(t.key);
              reload({ nextScope: t.key });
            }}
            aria-pressed={activeScope === t.key}
            className={`chip disabled:cursor-wait ${activeScope === t.key ? "chip-selected" : ""}`}
          >
            {activeScope === t.key && <Icon name="check" size={18} />}
            {t.label}（{scopeCounts[t.key]}张）
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
            {EMPTY_TEXT[scope]}
            {scope === "matched" && !hasRecipientNames && (
              <>
                <br />
                <a href="/account" className="text-primary underline">
                  设置常用收件名
                </a>
                后即可自动匹配。
              </>
            )}
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
                onReceive={scope === "claimed" ? receive : undefined}
                onCancelClaim={scope === "claimed" ? cancelClaim : undefined}
                onCancelReceive={
                  scope === "claimed" ? (id) => receiveWithMethod(id, "DELETE") : undefined
                }
                onClaim={scope === "matched" ? claim : undefined}
                onOpen={setDetailId}
              />
            ))}
          </div>
        )}

        {/* 切换分类时在视窗顶部显示 M3 线性进度条 */}
        {loadingPage && <LinearProgress />}
      </div>

      {detail && (
        <PostcardDetail
          postcard={detail}
          currentUserId={currentUserId}
          busy={busyId === detail.id}
          onClaim={scope === "matched" ? claim : undefined}
          onReceive={receive}
          onCancelClaim={cancelClaim}
          onCancelReceive={(id) => receiveWithMethod(id, "DELETE")}
          onHide={(id) => toggleHide(id, true)}
          onUnhide={(id) => toggleHide(id, false)}
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
