"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, type Postcard } from "@/lib/types";

type DuplicateCandidate = {
  postcard: Postcard;
  distance: number;
};

type DuplicateStatus = "idle" | "checking" | "done" | "unavailable" | "error";
const DUPLICATE_DISTANCE_THRESHOLD = 16;

// 在浏览器里把图片缩放 + 压成 JPEG，控制在 Vercel 函数 4.5MB 请求体限制内，
// 同时明显加快上传。失败（如 HEIC 浏览器无法解码）时回退用原文件。
async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<{ blob: Blob; filename: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法解码该图片"));
    image.src = dataUrl;
  });

  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("图片压缩失败");

  const base = file.name.replace(/\.[^.]+$/, "") || "postcard";
  return { blob, filename: `${base}.jpg` };
}

async function imageToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function dctCoefficient(values: number[], width: number, u: number, v: number) {
  let sum = 0;
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      sum +=
        values[y * width + x] *
        Math.cos(((2 * x + 1) * u * Math.PI) / (2 * width)) *
        Math.cos(((2 * y + 1) * v * Math.PI) / (2 * width));
    }
  }
  return sum;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function computeImageHash(file: Blob): Promise<string> {
  const dataUrl = await imageToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法解码该图片"));
    image.src = dataUrl;
  });

  const width = 32;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");
  ctx.drawImage(img, 0, 0, width, width);

  const pixels = ctx.getImageData(0, 0, width, width).data;
  const gray: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    gray.push(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
  }

  const lowFrequency: number[] = [];
  for (let v = 0; v < 8; v += 1) {
    for (let u = 0; u < 8; u += 1) {
      lowFrequency.push(dctCoefficient(gray, width, u, v));
    }
  }

  const threshold = median(lowFrequency.slice(1));
  const bits = lowFrequency.map((value, index) => (index > 0 && value > threshold ? "1" : "0"));
  let hash = "";
  for (let i = 0; i < bits.length; i += 4) {
    hash += parseInt(bits.slice(i, i + 4).join(""), 2).toString(16);
  }
  return hash;
}

function hammingDistanceHex(a: string, b: string) {
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance += diff.toString(2).replaceAll("0", "").length;
  }
  return distance;
}

function fmtDate(v: string | null): string | null {
  return v ? v.slice(0, 10) : null;
}

export default function UploadClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const checkSeqRef = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [note, setNote] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [duplicateStatus, setDuplicateStatus] = useState<DuplicateStatus>("idle");
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const seq = checkSeqRef.current + 1;
    checkSeqRef.current = seq;
    const file = e.target.files?.[0];
    setError(null);
    setImageHash(null);
    setDuplicateStatus("idle");
    setDuplicateCandidates([]);
    setDuplicateError(null);

    if (!file) {
      setPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    setPreview(URL.createObjectURL(file));

    try {
      setDuplicateStatus("checking");
      const hash = await computeImageHash(file);
      if (checkSeqRef.current !== seq) return;
      setImageHash(hash);

      const res = await fetch(`/api/postcards/duplicates?hash=${encodeURIComponent(hash)}`);
      const data = await res.json().catch(() => ({}));
      if (checkSeqRef.current !== seq) return;

      if (!res.ok) {
        setDuplicateStatus("error");
        setDuplicateError(data?.error || "重复检测失败，仍可继续上传");
        return;
      }

      const duplicates: DuplicateCandidate[] = Array.isArray(data?.duplicates)
        ? data.duplicates
        : [];
      const backfillHashes: { id: string; imageHash: string }[] = [];
      const unhashedPostcards: Postcard[] = Array.isArray(data?.unhashedPostcards)
        ? data.unhashedPostcards
        : [];

      for (const postcard of unhashedPostcards) {
        if (checkSeqRef.current !== seq) return;
        try {
          const imageRes = await fetch(
            `/api/postcards/image-proxy?id=${encodeURIComponent(postcard.id)}`
          );
          if (!imageRes.ok) continue;
          const blob = await imageRes.blob();
          const candidateHash = await computeImageHash(blob);
          backfillHashes.push({ id: postcard.id, imageHash: candidateHash });

          const distance = hammingDistanceHex(hash, candidateHash);
          if (distance <= DUPLICATE_DISTANCE_THRESHOLD) {
            duplicates.push({ postcard: { ...postcard, image_hash: candidateHash }, distance });
          }
        } catch {
          // Best effort: an inaccessible old image should not block this upload.
        }
      }

      if (checkSeqRef.current !== seq) return;

      if (backfillHashes.length > 0) {
        fetch("/api/postcards/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hashes: backfillHashes }),
        }).catch(() => undefined);
      }

      setDuplicateCandidates(
        duplicates.sort((a, b) => a.distance - b.distance).slice(0, 3)
      );
      setDuplicateStatus(data?.unavailable ? "unavailable" : "done");
    } catch {
      if (checkSeqRef.current !== seq) return;
      setDuplicateStatus("error");
      setDuplicateError("暂时无法检测重复，仍可继续上传");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("请先选择明信片正面照片");
      return;
    }
    if (!recipientName.trim()) {
      setError("请填写收件人姓名");
      return;
    }
    if (duplicateStatus === "checking") {
      setError("照片重复检测还在进行，请稍等片刻");
      return;
    }

    setSubmitting(true);
    try {
      // 1. 客户端压缩（HEIC 等无法解码时回退原文件）。
      const MAX_BYTES = 4.4 * 1024 * 1024;
      let uploadBlob: Blob = file;
      let filename = file.name;
      try {
        const compressed = await compressImage(file);
        uploadBlob = compressed.blob;
        filename = compressed.filename;
      } catch {
        if (file.size > MAX_BYTES) {
          setError("这张图片无法自动压缩且超过 4MB，请换成 JPG/PNG 或更小的图片");
          return;
        }
        // 原文件够小，直接用原文件上传
      }

      // 2. 传到我们自己的同源接口（国内可达），由服务器端转存到 Blob。
      const uploadRes = await fetch(
        `/api/blob/upload?filename=${encodeURIComponent(filename)}`,
        {
          method: "POST",
          headers: { "Content-Type": uploadBlob.type || "image/jpeg" },
          body: uploadBlob,
        }
      );
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.url) {
        setError(uploadData?.error || "图片上传失败，请重试");
        return;
      }

      // 3. 创建明信片记录。
      const res = await fetch("/api/postcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploadData.url,
          recipientName: recipientName.trim(),
          note: note.trim() || undefined,
          sentAt: sentAt || undefined,
          arrivedAt: arrivedAt || undefined,
          imageHash: imageHash || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "提交失败");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mb-2 text-3xl">🎉</div>
        <p className="font-medium text-emerald-800">上传成功，正在返回广场…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium">明信片正面照片</label>
        <label className="flex aspect-[3/2] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted transition hover:border-primary">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="预览" className="h-full w-full object-cover" />
          ) : (
            <span className="px-4 text-center text-sm text-muted-foreground">
              点击选择图片<br />（JPG / PNG / WEBP，≤10MB）
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
        </label>
      </div>

      {duplicateStatus === "checking" && (
        <p className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
          正在检测是否已有疑似同一张明信片…
        </p>
      )}

      {duplicateStatus === "unavailable" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          暂时无法启用重复检测，请确认数据库已加入 image_hash 字段；你仍可继续上传。
        </p>
      )}

      {duplicateStatus === "error" && duplicateError && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {duplicateError}
        </p>
      )}

      {duplicateCandidates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-3 text-sm font-medium text-amber-800">
            检测到可能是同一张明信片的记录，请确认后再发布。
          </p>
          <div className="space-y-3">
            {duplicateCandidates.map(({ postcard, distance }) => (
              <div
                key={postcard.id}
                className="grid grid-cols-[96px_1fr] gap-3 rounded-md bg-background/80 p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={postcard.image_url}
                  alt={`疑似重复：${postcard.recipient_name}`}
                  className="aspect-[3/2] w-24 rounded object-cover"
                />
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{postcard.recipient_name}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {STATUS_LABEL[postcard.status]}
                    </span>
                  </div>
                  {postcard.note && (
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{postcard.note}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    上传于 {fmtDate(postcard.created_at) || "未知"}，相似度参考值 {64 - distance}/64
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          收件人姓名 <span className="text-primary">*</span>
        </label>
        <input
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="明信片上写的收件人姓名"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          maxLength={64}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          备注 <span className="text-muted-foreground">（可选）</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：来自哪次活动、取件地点等"
          rows={3}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          maxLength={500}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            寄出时间 <span className="text-muted-foreground">（可选）</span>
          </label>
          <input
            type="date"
            value={sentAt}
            onChange={(e) => setSentAt(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            到达时间 <span className="text-muted-foreground">（落地戳 · 可选）</span>
          </label>
          <input
            type="date"
            value={arrivedAt}
            onChange={(e) => setArrivedAt(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "上传中…" : "发布明信片"}
      </button>
    </form>
  );
}
