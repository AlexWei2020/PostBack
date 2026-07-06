"use client";

import Image from "next/image";
import { STATUS_LABEL, type Postcard } from "@/lib/types";

const STATUS_STYLE: Record<Postcard["status"], string> = {
  available: "bg-primary/10 text-primary",
  claimed: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

export default function PostcardCard({
  postcard,
  currentUserId,
  busy,
  onClaim,
  onReceive,
  onOpen,
}: {
  postcard: Postcard;
  currentUserId: string;
  busy?: boolean;
  onClaim?: (id: string) => void;
  onReceive?: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  const isClaimer = postcard.claimer_id === currentUserId;
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
      className={`flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md ${
        onOpen ? "cursor-pointer" : ""
      }`}
    >
      <div className="relative aspect-[3/2] w-full bg-muted">
        {/* Blob images are on an allowed remote host; unoptimized keeps it simple */}
        <Image
          src={postcard.image_url}
          alt={`寄给 ${postcard.recipient_name} 的明信片`}
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, 320px"
          className="object-cover"
        />
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[postcard.status]}`}
        >
          {STATUS_LABEL[postcard.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="text-xs text-muted-foreground">收件人</p>
          <p className="font-semibold">{postcard.recipient_name}</p>
        </div>
        {postcard.note && (
          <p className="text-sm text-muted-foreground line-clamp-2">{postcard.note}</p>
        )}

        <div className="mt-auto pt-2">
          {postcard.status === "available" && onClaim && (
            <button
              onClick={stop(onClaim)}
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "处理中…" : "认领这张"}
            </button>
          )}

          {postcard.status === "claimed" && isClaimer && onReceive && (
            <button
              onClick={stop(onReceive)}
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "处理中…" : "确认已收到"}
            </button>
          )}

          {postcard.status === "claimed" && !isClaimer && (
            <p className="text-center text-xs text-muted-foreground">
              已被 {postcard.claimer_nickname || "他人"} 认领
            </p>
          )}

          {postcard.status === "received" && (
            <p className="text-center text-xs text-muted-foreground">已完成</p>
          )}
        </div>
      </div>
    </div>
  );
}
