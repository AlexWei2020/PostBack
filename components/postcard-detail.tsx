"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { STATUS_LABEL, type Postcard } from "@/lib/types";

const STATUS_STYLE: Record<Postcard["status"], string> = {
  available: "bg-primary/10 text-primary",
  claimed: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

function fmtDate(v: string | null): string | null {
  if (!v) return null;
  // sent_at / arrived_at come back as "YYYY-MM-DD"
  return v.slice(0, 10);
}

function fmtDateTime(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function PostcardDetail({
  postcard,
  currentUserId,
  busy,
  onClaim,
  onReceive,
  onDelete,
  onClose,
}: {
  postcard: Postcard;
  currentUserId: string;
  busy?: boolean;
  onClaim?: (id: string) => void;
  onReceive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isClaimer = postcard.claimer_id === currentUserId;
  const canDelete = isClaimer && postcard.status === "received" && !!onDelete;

  // ESC closes the zoom first, then the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoomed) setZoomed(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 图片：点击放大 */}
        <div
          className="relative aspect-[3/2] w-full cursor-zoom-in bg-muted"
          onClick={() => setZoomed(true)}
        >
          <Image
            src={postcard.image_url}
            alt={`寄给 ${postcard.recipient_name} 的明信片`}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 512px"
            className="object-cover"
          />
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[postcard.status]}`}
          >
            {STATUS_LABEL[postcard.status]}
          </span>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
            点击放大
          </span>
        </div>

        <div className="p-5">
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">收件人</p>
            <p className="text-lg font-semibold">{postcard.recipient_name}</p>
          </div>

          {postcard.note && (
            <p className="mb-3 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">
              {postcard.note}
            </p>
          )}

          <div className="divide-y divide-border">
            <InfoRow label="寄出时间" value={fmtDate(postcard.sent_at)} />
            <InfoRow label="到达时间（落地戳）" value={fmtDate(postcard.arrived_at)} />
            <InfoRow label="上传者" value={postcard.uploader_nickname || null} />
            <InfoRow label="认领者" value={postcard.claimer_nickname || null} />
            <InfoRow label="上传于" value={fmtDateTime(postcard.created_at)} />
            <InfoRow label="认领于" value={fmtDateTime(postcard.claimed_at)} />
            <InfoRow label="收到于" value={fmtDateTime(postcard.received_at)} />
          </div>

          {/* 操作区 */}
          <div className="mt-5 flex flex-col gap-2">
            {postcard.status === "available" && onClaim && (
              <button
                onClick={() => onClaim(postcard.id)}
                disabled={busy}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "处理中…" : "认领这张"}
              </button>
            )}

            {postcard.status === "claimed" && isClaimer && onReceive && (
              <button
                onClick={() => onReceive(postcard.id)}
                disabled={busy}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "处理中…" : "确认已收到"}
              </button>
            )}

            {canDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                删除这条记录
              </button>
            )}

            {canDelete && confirmDelete && (
              <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">删除后无法恢复，确认删除？</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDelete?.(postcard.id)}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "删除中…" : "确认删除"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition hover:opacity-80 disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition hover:opacity-80"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      {/* 全屏放大预览 */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setZoomed(false);
          }}
        >
          <div className="relative h-full w-full">
            <Image
              src={postcard.image_url}
              alt={`寄给 ${postcard.recipient_name} 的明信片`}
              fill
              unoptimized
              sizes="100vw"
              className="cursor-zoom-out object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
