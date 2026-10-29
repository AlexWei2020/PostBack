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
      className="mt-6 flex min-h-12 items-center justify-center gap-3 text-body-medium text-on-surface-variant"
    >
      {failed ? (
        <>
          <span>加载失败</span>
          <button type="button" onClick={onRetry} className="btn-text">
            重试
          </button>
        </>
      ) : loadingMore || hasMore ? (
        <>
          <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-secondary-container border-t-primary" />
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
