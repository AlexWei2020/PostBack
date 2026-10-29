"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { STATUS_LABEL, type Postcard } from "@/lib/types";

// 状态标签用 M3 配色角色：待认领 primary、已认领 tertiary、已收到 success 容器色。
export const STATUS_STYLE: Record<Postcard["status"], string> = {
  available: "bg-primary-container text-on-primary-container",
  claimed: "bg-tertiary-container text-on-tertiary-container",
  received: "bg-success-container text-on-success-container",
};

function PostcardCard({
  postcard,
  currentUserId,
  busy,
  priority,
  onClaim,
  onReceive,
  onCancelClaim,
  onCancelReceive,
  onOpen,
}: {
  postcard: Postcard;
  currentUserId: string;
  busy?: boolean;
  priority?: boolean;
  onClaim?: (id: string) => void;
  onReceive?: (id: string) => void;
  onCancelClaim?: (id: string) => void;
  onCancelReceive?: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  const isClaimer = postcard.claimer_id === currentUserId;
  const [imgLoaded, setImgLoaded] = useState(false);
  // Action buttons live inside the clickable card — stop them from also
  // opening the detail modal.
  const stop =
    (fn?: (id: string) => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      fn?.(postcard.id);
    };

  return (
    <div
      onClick={() => onOpen?.(postcard.id)}
      className={`card-outlined flex flex-col overflow-hidden ${
        onOpen ? "state-layer cursor-pointer" : ""
      }`}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface-container-highest">
        {!imgLoaded && (
          <span className="absolute inset-0 animate-pulse bg-surface-container-high" />
        )}
        {/* Blob images are on an allowed remote host; unoptimized keeps it simple */}
        <Image
          src={postcard.image_url}
          alt={`寄给 ${postcard.recipient_name} 的明信片`}
          fill
          priority={priority}
          loading={priority ? undefined : "lazy"}
          quality={55}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          onLoad={() => setImgLoaded(true)}
          className={`object-cover transition-opacity duration-300 ease-standard ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-label-medium text-on-surface-variant">收件人</p>
            <p className="truncate text-title-medium text-on-surface">{postcard.recipient_name}</p>
          </div>
          <span
            className={`inline-flex h-6 shrink-0 items-center rounded-sm px-2 text-label-medium ${STATUS_STYLE[postcard.status]}`}
          >
            {STATUS_LABEL[postcard.status]}
          </span>
        </div>
        {postcard.note && (
          <p className="line-clamp-2 text-body-medium text-on-surface-variant">{postcard.note}</p>
        )}
        {postcard.pickup_location && (
          <p className="text-body-small text-on-surface-variant">取件地点：{postcard.pickup_location}</p>
        )}
        {postcard.hidden_by_claimer && (
          <p className="text-body-small text-on-surface-variant">已隐藏 · 仅自己可见</p>
        )}

        <div className="mt-auto pt-3">
          {postcard.status === "available" && onClaim && (
            <button
              onClick={stop(onClaim)}
              disabled={busy}
              className="btn-filled w-full"
            >
              {busy ? "处理中…" : "认领这张"}
            </button>
          )}

          {postcard.status === "claimed" && isClaimer && (onReceive || onCancelClaim) && (
            <div className="flex flex-col gap-2">
              {onReceive && (
                <button
                  onClick={stop(onReceive)}
                  disabled={busy}
                  className="btn-filled w-full"
                >
                  {busy ? "处理中…" : "确认已收到"}
                </button>
              )}
              {onCancelClaim && (
                <button
                  onClick={stop(onCancelClaim)}
                  disabled={busy}
                  className="btn-outlined w-full"
                >
                  取消认领
                </button>
              )}
            </div>
          )}

          {postcard.status === "claimed" && !isClaimer && (
            <p className="text-center text-body-small text-on-surface-variant">
              已被 {postcard.claimer_nickname || "他人"} 认领
            </p>
          )}

          {postcard.status === "received" && isClaimer && onCancelReceive && (
            <div className="flex flex-col gap-2">
              <button
                onClick={stop(onCancelReceive)}
                disabled={busy}
                className="btn-outlined w-full"
              >
                取消签收
              </button>
              {onCancelClaim && (
                <button
                  onClick={stop(onCancelClaim)}
                  disabled={busy}
                  className="btn-text w-full !text-error"
                >
                  取消认领
                </button>
              )}
            </div>
          )}

          {postcard.status === "received" && (!isClaimer || !onCancelReceive) && (
            <p className="text-center text-body-small text-on-surface-variant">已完成</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Lists re-render on every claim/receive/paging action; memo skips cards whose
// props are unchanged so only the affected card (and its image) touch the DOM.
export default memo(PostcardCard);
