import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// 服务器端转存上传：
// 浏览器把（已压缩的）图片 POST 到本接口（同源 post.alexwei.top，走 Cloudflare，
// 国内可达），再由服务器端 put() 到 Vercel Blob。避免浏览器直连
// *.blob.vercel-storage.com（国内常超时/被墙，导致上传一直卡住）。
// 代价是受 Vercel 函数 ~4.5MB 请求体限制，所以客户端会先压缩图片。
const MAX_BYTES = 4.4 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    if (!request.body) {
      return NextResponse.json({ error: "缺少文件内容" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const rawName = searchParams.get("filename") || `postcard-${Date.now()}.jpg`;
    const filename = rawName.replace(/[^\w.\-]+/g, "_").slice(0, 100);
    const contentType = request.headers.get("content-type") || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "只能上传图片" }, { status: 400 });
    }

    const buf = await request.arrayBuffer();
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "文件为空" }, { status: 400 });
    }
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "图片过大（压缩后仍超过 4MB），请换一张更小的图片" },
        { status: 413 }
      );
    }

    const blob = await put(filename, Buffer.from(buf), {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Blob upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图片上传失败" },
      { status: 500 }
    );
  }
}
