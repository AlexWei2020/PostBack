"use client";

import type { RefObject } from "react";

// 列表底部：动态加载的哨兵 + 进度/状态提示。
export default function LoadMoreFooter({
  sentinelRef,
  loaded,
  total,
  hasMore,
  loadingMore,
  failed,
  onRetry,
}: {
  sentinelRef: RefObject<HTMLDivElement | null>;
  loaded: number;
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      ref={sentinelRef}
      className="mt-6 flex min-h-12 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      {failed ? (
        <>
          <span>加载失败</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-border px-3 py-1 text-foreground transition hover:border-foreground hover:bg-muted"
          >
            重试
          </button>
        </>
      ) : loadingMore || hasMore ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          <span>
            加载中…（已显示 {loaded}/{total} 张）
          </span>
        </>
      ) : (
        <span>已全部加载，共 {total} 张</span>
      )}
    </div>
  );
}
