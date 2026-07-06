import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少明信片 ID" }, { status: 400 });

  const result = await pool.query("select image_url from postcards where id = $1", [id]);
  const imageUrl = result.rows[0]?.image_url as string | undefined;

  if (!imageUrl || !/^https:\/\/[^\s]+$/.test(imageUrl)) {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    return NextResponse.json({ error: "图片读取失败" }, { status: 502 });
  }

  const contentType = imageRes.headers.get("content-type") || "image/jpeg";
  const bytes = await imageRes.arrayBuffer();

  return new NextResponse(bytes, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
    },
  });
}
