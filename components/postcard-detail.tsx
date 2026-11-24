"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
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
  error,
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
  error?: string | null;
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
  const detailDialog = useRef<HTMLDialogElement>(null);
  const zoomDialog = useRef<HTMLDialogElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<PostcardUpdateInput | null>(null);
  const editing = form !== null;

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
    const dialog = detailDialog.current;
    const preview = zoomDialog.current;
    dialog?.showModal();
    return () => {
      preview?.close();
      dialog?.close();
    };
  }, []);

  const closeDetail = () => {
    detailDialog.current?.close();
    onClose();
  };

  const setField =
    (key: keyof PostcardUpdateInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => prev && { ...prev, [key]: e.target.value });
    };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdate || !form) return;

    const ok = await onUpdate(postcard.id, {
      recipientName: form.recipientName.trim(),
      pickupLocation: form.pickupLocation?.trim() || undefined,
      note: form.note?.trim() || undefined,
      sentAt: form.sentAt || undefined,
      arrivedAt: form.arrivedAt || undefined,
    });
    if (ok !== false) setForm(null);
  };

  return (
    <>
      <dialog
        ref={detailDialog}
        aria-label={`寄给 ${postcard.recipient_name} 的明信片`}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-xl bg-surface-container-high text-on-surface shadow-elevation-3 backdrop:bg-scrim/[0.32]"
        onCancel={(e) => {
          e.preventDefault();
          closeDetail();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDetail();
        }}
      >
        <button
          type="button"
          className="relative block aspect-[3/2] w-full cursor-zoom-in overflow-hidden bg-surface-container-highest focus-visible:-outline-offset-4"
          onClick={() => zoomDialog.current?.showModal()}
          aria-label="放大明信片照片"
          aria-haspopup="dialog"
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
        </button>

        <div className="p-6 [--field-bg:var(--md-surface-container-high)]">
          {error && (
            <p role="alert" className="mb-4 rounded-md bg-error-container px-4 py-3 text-body-medium text-on-error-container">
              {error}
            </p>
          )}
          {form ? (
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

              <div className="grid grid-cols-1 gap-3 medium:grid-cols-2">
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

          {/* 主操作：至多一个 filled 按钮（M3：一个页面/对话框只突出一个主操作） */}
          {!editing && postcard.status === "available" && onClaim && (
            <button
              onClick={() => onClaim(postcard.id)}
              disabled={busy}
              className="btn-filled mt-6"
            >
              {busy ? "处理中…" : "认领这张"}
            </button>
          )}
          {!editing && postcard.status === "claimed" && isClaimer && onReceive && (
            <button
              onClick={() => onReceive(postcard.id)}
              disabled={busy}
              className="btn-filled mt-6"
            >
              {busy ? "处理中…" : "确认已收到"}
            </button>
          )}

          {/* 次要操作：outlined 按钮，可换行 */}
          {!editing && (
            <div className="mt-3 flex flex-wrap gap-2 empty:hidden">
              {postcard.status === "received" && isClaimer && onCancelReceive && (
                <button onClick={() => onCancelReceive(postcard.id)} disabled={busy} className="btn-outlined">
                  {busy ? "处理中…" : "取消签收"}
                </button>
              )}
              {(postcard.status === "claimed" || postcard.status === "received") && isClaimer && onCancelClaim && (
                <button
                  onClick={() => onCancelClaim(postcard.id)}
                  disabled={busy}
                  className={postcard.status === "received" ? "btn-text enabled:text-error" : "btn-outlined"}
                >
                  {busy ? "处理中…" : "取消认领"}
                </button>
              )}
              {canHideToggle &&
                (postcard.hidden_by_claimer
                  ? onUnhide && (
                      <button onClick={() => onUnhide(postcard.id)} disabled={busy} className="btn-outlined">
                        {busy ? "处理中…" : "取消隐藏（重新在广场展示）"}
                      </button>
                    )
                  : onHide && (
                      <button onClick={() => onHide(postcard.id)} disabled={busy} className="btn-outlined">
                        {busy ? "处理中…" : "隐藏（仅自己可见）"}
                      </button>
                    ))}
            </div>
          )}

          {canDelete && !editing && confirmDelete && (
            <div className="mt-4 rounded-md bg-error-container p-4 text-on-error-container">
              <p className="text-body-medium">删除后无法恢复，确认删除？</p>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(false)} disabled={busy} className="btn-text">
                  取消
                </button>
                <button onClick={() => onDelete?.(postcard.id)} disabled={busy} className="btn-error">
                  {busy ? "删除中…" : "确认删除"}
                </button>
              </div>
            </div>
          )}

          {/* 按模式重建操作区，避免编辑按钮在本次点击中变成提交按钮。 */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            {editing ? (
              <Fragment key="edit">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  disabled={busy}
                  className="btn-text"
                >
                  取消
                </button>
                <button type="submit" form="postcard-edit-form" disabled={busy} className="btn-text">
                  {busy ? "保存中…" : "保存"}
                </button>
              </Fragment>
            ) : (
              <Fragment key="view">
                {canDelete && !confirmDelete && (
                  <button onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-text mr-auto enabled:text-error">
                    <Icon name="delete" size={18} />
                    删除
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false);
                      setForm(formFromPostcard(postcard));
                    }}
                    disabled={busy}
                    className="btn-text"
                  >
                    <Icon name="edit" size={18} />
                    编辑
                  </button>
                )}
                <button onClick={closeDetail} className="btn-text">
                  关闭
                </button>
              </Fragment>
            )}
          </div>
        </div>
      </dialog>

      {/* 全屏放大预览 */}
      <dialog
        ref={zoomDialog}
        aria-label="明信片照片预览"
        className="fixed inset-0 h-full max-h-none w-full max-w-none bg-transparent p-4 backdrop:bg-scrim/90"
        onClick={(e) => {
          if (e.target === e.currentTarget) zoomDialog.current?.close();
        }}
      >
        <button
          type="button"
          aria-label="关闭照片预览"
          className="relative block h-full w-full cursor-zoom-out focus-visible:-outline-offset-4"
          onClick={() => zoomDialog.current?.close()}
        >
          <Image
            src={postcard.image_url}
            alt={`寄给 ${postcard.recipient_name} 的明信片`}
            fill
            unoptimized
            sizes="100vw"
            className="object-contain"
          />
        </button>
      </dialog>
    </>
  );
}
