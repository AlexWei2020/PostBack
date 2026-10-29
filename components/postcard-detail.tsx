"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { STATUS_LABEL, type Postcard, type PostcardUpdateInput } from "@/lib/types";
import Icon from "@/components/icon";
import { STATUS_STYLE } from "@/components/postcard-card";
import { COMMON_PICKUP_LOCATIONS } from "@/lib/pickup-locations";


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
    <div className="flex justify-between gap-4 py-3 text-body-medium">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right text-on-surface">{value}</span>
    </div>
  );
}

function toDateInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

function formFromPostcard(postcard: Postcard): PostcardUpdateInput {
  return {
    recipientName: postcard.recipient_name,
    pickupLocation: postcard.pickup_location || "",
    note: postcard.note || "",
    sentAt: toDateInput(postcard.sent_at),
    arrivedAt: toDateInput(postcard.arrived_at),
  };
}

export default function PostcardDetail({
  postcard,
  currentUserId,
  busy,
  onClaim,
  onReceive,
  onCancelClaim,
  onCancelReceive,
  onHide,
  onUnhide,
  onUpdate,
  onDelete,
  onClose,
}: {
  postcard: Postcard;
  currentUserId: string;
  busy?: boolean;
  onClaim?: (id: string) => void;
  onReceive?: (id: string) => void;
  onCancelClaim?: (id: string) => void;
  onCancelReceive?: (id: string) => void;
  onHide?: (id: string) => void;
  onUnhide?: (id: string) => void;
  onUpdate?: (id: string, input: PostcardUpdateInput) => boolean | Promise<boolean>;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PostcardUpdateInput>(() => formFromPostcard(postcard));

  const isUploader = postcard.uploader_id === currentUserId;
  const isClaimer = postcard.claimer_id === currentUserId;
  const canEdit = isUploader && !!onUpdate;
  const canDelete =
    (isUploader || (isClaimer && postcard.status === "received")) && !!onDelete;
  const canHideToggle =
    isClaimer &&
    (postcard.status === "claimed" || postcard.status === "received") &&
    (!!onHide || !!onUnhide);

  useEffect(() => {
    setConfirmDelete(false);
    setEditing(false);
    setForm(formFromPostcard(postcard));
  }, [postcard.id]);

  useEffect(() => {
    if (!editing) setForm(formFromPostcard(postcard));
  }, [editing, postcard]);

  const setField =
    (key: keyof PostcardUpdateInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdate) return;

    const ok = await onUpdate(postcard.id, {
      recipientName: form.recipientName.trim(),
      pickupLocation: form.pickupLocation?.trim() || undefined,
      note: form.note?.trim() || undefined,
      sentAt: form.sentAt || undefined,
      arrivedAt: form.arrivedAt || undefined,
    });
    if (ok !== false) setEditing(false);
  };

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
      className="fixed inset-0 z-40 flex items-center justify-center bg-scrim/[0.32] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`寄给 ${postcard.recipient_name} 的明信片`}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-container-high shadow-elevation-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 图片：点击放大 */}
        <div
          className="relative aspect-[3/2] w-full cursor-zoom-in overflow-hidden bg-surface-container-highest"
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
          <span className="absolute bottom-3 right-3 inline-flex h-8 items-center gap-1 rounded-sm bg-inverse-surface/80 px-3 text-label-large text-inverse-on-surface">
            <Icon name="zoom_in" size={18} />
            点击放大
          </span>
        </div>

        <div className="p-6 [--field-bg:var(--md-surface-container-high)]">
          {editing ? (
            <form id="postcard-edit-form" onSubmit={saveEdit} className="flex flex-col gap-4">
              <label className="field">
                <input
                  value={form.recipientName}
                  onChange={setField("recipientName")}
                  className="field-input"
                  maxLength={64}
                  placeholder=" "
                />
                <span className="field-label">收件人姓名 *</span>
              </label>

              <label className="field">
                <textarea
                  value={form.note || ""}
                  onChange={setField("note")}
                  rows={3}
                  className="field-input resize-none"
                  maxLength={500}
                  placeholder=" "
                />
                <span className="field-label">备注（可选）</span>
              </label>

              <div>
                <p className="mb-2 text-body-small text-on-surface-variant">
                  取件地点（可选）
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PICKUP_LOCATIONS.map((location) => (
                    <label
                      key={location}
                      className={`chip ${form.pickupLocation === location ? "chip-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="editPickupLocation"
                        value={location}
                        checked={form.pickupLocation === location}
                        onChange={setField("pickupLocation")}
                        className="sr-only"
                      />
                      {form.pickupLocation === location && <Icon name="check" size={18} />}
                      {location}
                    </label>
                  ))}
                </div>
                <label className="field mt-3">
                  <input
                    value={
                    COMMON_PICKUP_LOCATIONS.includes(form.pickupLocation || "")
                    ? ""
                    : form.pickupLocation || ""
                    }
                    onChange={setField("pickupLocation")}
                    maxLength={80}
                    placeholder=" "
                    className="field-input"
                  />
                  <span className="field-label">添加新地点</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="field">
                  <input
                    type="date"
                    value={form.sentAt || ""}
                    onChange={setField("sentAt")}
                    className="field-input"
                    placeholder=" "
                  />
                  <span className="field-label">寄出时间（可选）</span>
                </label>
                <label className="field">
                  <input
                    type="date"
                    value={form.arrivedAt || ""}
                    onChange={setField("arrivedAt")}
                    className="field-input"
                    placeholder=" "
                  />
                  <span className="field-label">到达时间（可选）</span>
                </label>
              </div>
            </form>
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label-medium text-on-surface-variant">收件人</p>
                  <h2 className="break-words text-headline-small text-on-surface">
                    {postcard.recipient_name}
                  </h2>
                </div>
                <span
                  className={`mt-1 inline-flex h-6 shrink-0 items-center rounded-sm px-2 text-label-medium ${STATUS_STYLE[postcard.status]}`}
                >
                  {STATUS_LABEL[postcard.status]}
                </span>
              </div>

              {postcard.hidden_by_claimer && (
                <p className="mb-3 inline-flex h-8 items-center gap-2 rounded-sm bg-surface-container-highest px-3 text-label-large text-on-surface-variant">
                  已隐藏 · 仅自己可见（不在广场展示）
                </p>
              )}

              {postcard.note && (
                <p className="mb-3 whitespace-pre-wrap rounded-sm bg-surface-container-highest px-4 py-3 text-body-medium text-on-surface">
                  {postcard.note}
                </p>
              )}

              <div className="divide-y divide-outline-variant">
                <InfoRow label="寄出时间" value={fmtDate(postcard.sent_at)} />
                <InfoRow label="到达时间（落地戳）" value={fmtDate(postcard.arrived_at)} />
                <InfoRow label="取件地点" value={postcard.pickup_location || null} />
                <InfoRow label="上传者" value={postcard.uploader_nickname || null} />
                <InfoRow label="认领者" value={postcard.claimer_nickname || null} />
                <InfoRow label="上传于" value={fmtDateTime(postcard.created_at)} />
                <InfoRow label="认领于" value={fmtDateTime(postcard.claimed_at)} />
                <InfoRow label="收到于" value={fmtDateTime(postcard.received_at)} />
              </div>
            </>
          )}

          {/* 操作区 */}
          <div className="mt-6 flex flex-col gap-2">
            {!editing && postcard.status === "available" && onClaim && (
              <button
                onClick={() => onClaim(postcard.id)}
                disabled={busy}
                className="btn-filled w-full"
              >
                {busy ? "处理中…" : "认领这张"}
              </button>
            )}

            {!editing && postcard.status === "claimed" && isClaimer && onReceive && (
              <button
                onClick={() => onReceive(postcard.id)}
                disabled={busy}
                className="btn-filled w-full"
              >
                {busy ? "处理中…" : "确认已收到"}
              </button>
            )}

            {!editing && postcard.status === "claimed" && isClaimer && onCancelClaim && (
              <button
                onClick={() => onCancelClaim(postcard.id)}
                disabled={busy}
                className="btn-outlined w-full"
              >
                {busy ? "处理中…" : "取消认领"}
              </button>
            )}

            {!editing && postcard.status === "received" && isClaimer && onCancelReceive && (
              <button
                onClick={() => onCancelReceive(postcard.id)}
                disabled={busy}
                className="btn-outlined w-full"
              >
                {busy ? "处理中…" : "取消签收"}
              </button>
            )}

            {!editing && postcard.status === "received" && isClaimer && onCancelClaim && (
              <button
                onClick={() => onCancelClaim(postcard.id)}
                disabled={busy}
                className="btn-text w-full !text-error"
              >
                {busy ? "处理中…" : "取消认领"}
              </button>
            )}

            {!editing && canHideToggle && (
              postcard.hidden_by_claimer
                ? onUnhide && (
                    <button
                      onClick={() => onUnhide(postcard.id)}
                      disabled={busy}
                      className="btn-outlined w-full"
                    >
                      {busy ? "处理中…" : "取消隐藏（重新在广场展示）"}
                    </button>
                  )
                : onHide && (
                    <button
                      onClick={() => onHide(postcard.id)}
                      disabled={busy}
                      className="btn-outlined w-full"
                    >
                      {busy ? "处理中…" : "隐藏（仅自己可见）"}
                    </button>
                  )
            )}

            {canEdit && !editing && (
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  setEditing(true);
                }}
                disabled={busy}
                className="btn-outlined w-full"
              >
                编辑这张明信片
              </button>
            )}

            {editing && (
              <div className="flex gap-2">
                <button
                  type="submit"
                  form="postcard-edit-form"
                  disabled={busy}
                  className="btn-filled flex-1"
                >
                  {busy ? "保存中…" : "保存修改"}
                </button>
                <button
                  onClick={() => {
                    setForm(formFromPostcard(postcard));
                    setEditing(false);
                  }}
                  disabled={busy}
                  className="btn-outlined flex-1"
                >
                  取消
                </button>
              </div>
            )}

            {canDelete && !editing && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="btn-text w-full !text-error"
              >
                删除这条记录
              </button>
            )}

            {canDelete && !editing && confirmDelete && (
              <div className="flex flex-col gap-3 rounded-md bg-error-container p-4">
                <p className="text-body-medium text-on-error-container">删除后无法恢复，确认删除？</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDelete?.(postcard.id)}
                    disabled={busy}
                    className="btn-error flex-1"
                  >
                    {busy ? "删除中…" : "确认删除"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    className="btn-text flex-1"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="btn-text w-full"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      {/* 全屏放大预览 */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/90 p-4"
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
