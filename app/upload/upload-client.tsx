"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function UploadClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [note, setNote] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) {
      setPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    setPreview(URL.createObjectURL(file));
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
