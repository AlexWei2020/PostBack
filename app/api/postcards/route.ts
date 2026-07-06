import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/postcards            -> all postcards (newest first)
// GET /api/postcards?status=available
// GET /api/postcards?mine=1     -> postcards claimed by the current user
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const mine = searchParams.get("mine");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (mine === "1") {
    params.push(user.id);
    conditions.push(`p.claimer_id = $${params.length}`);
  }
  if (status && ["available", "claimed", "received"].includes(status)) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const result = await pool.query(
    `
    select
      p.*,
      up.nickname as uploader_nickname,
      cl.nickname as claimer_nickname
    from postcards p
    left join users up on p.uploader_id = up.id
    left join users cl on p.claimer_id = cl.id
    ${where}
    order by p.created_at desc
    `,
    params
  );

  return NextResponse.json({ postcards: result.rows, currentUserId: user.id });
}

// POST /api/postcards  { imageUrl, recipientName, note? }
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const imageUrl = String(body?.imageUrl || "").trim();
  const recipientName = String(body?.recipientName || "").trim();
  const note = body?.note ? String(body.note).trim() : null;

  if (!imageUrl || !recipientName) {
    return NextResponse.json(
      { error: "图片和收件人姓名为必填项" },
      { status: 400 }
    );
  }
  if (!/^https:\/\/[^\s]+/.test(imageUrl)) {
    return NextResponse.json({ error: "图片地址无效" }, { status: 400 });
  }

  const result = await pool.query(
    `
    insert into postcards (image_url, recipient_name, note, uploader_id, status)
    values ($1, $2, $3, $4, 'available')
    returning *
    `,
    [imageUrl, recipientName, note, user.id]
  );

  return NextResponse.json({ postcard: result.rows[0] }, { status: 201 });
}
