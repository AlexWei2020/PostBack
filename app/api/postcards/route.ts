import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ensureImageHashColumn, normalizeImageHash } from "@/lib/postcard-image-hash";
import { ensurePostcardMetadataColumns } from "@/lib/schema";
import type { PostcardCounts } from "@/lib/types";

// GET /api/postcards            -> all postcards (newest first)
// GET /api/postcards?status=available
// GET /api/postcards?mine=1     -> postcards claimed by the current user
function positiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const mine = searchParams.get("mine");
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(100, positiveInt(searchParams.get("pageSize"), 20));
  const offset = (page - 1) * pageSize;

  const baseConditions: string[] = [];
  const baseParams: unknown[] = [];

  if (mine === "1") {
    baseParams.push(user.id);
    baseConditions.push(`p.claimer_id = $${baseParams.length}`);
  }

  const conditions = [...baseConditions];
  const params = [...baseParams];
  if (status && ["available", "claimed", "received"].includes(status)) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const baseWhere = baseConditions.length ? `where ${baseConditions.join(" and ")}` : "";

  params.push(pageSize, offset);
  const limitParam = params.length - 1;
  const offsetParam = params.length;

  const [result, countResult] = await Promise.all([
    pool.query(
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
      limit $${limitParam} offset $${offsetParam}
      `,
      params
    ),
    pool.query(
      `
      select p.status, count(*)::int as count
      from postcards p
      ${baseWhere}
      group by p.status
      `,
      baseParams
    ),
  ]);

  const counts: PostcardCounts = { all: 0, available: 0, claimed: 0, received: 0 };
  for (const row of countResult.rows) {
    if (row.status in counts) {
      counts[row.status as keyof PostcardCounts] = row.count;
      counts.all += row.count;
    }
  }
  const total =
    status && ["available", "claimed", "received"].includes(status)
      ? counts[status as keyof PostcardCounts]
      : counts.all;

  return NextResponse.json({
    postcards: result.rows,
    counts,
    pagination: { page, pageSize, total },
    currentUserId: user.id,
  });
}

// POST /api/postcards  { imageUrl, recipientName, pickupLocation?, note?, sentAt?, arrivedAt?, imageHash? }
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const imageUrl = String(body?.imageUrl || "").trim();
  const recipientName = String(body?.recipientName || "").trim();
  const pickupLocation = body?.pickupLocation ? String(body.pickupLocation).trim() : null;
  const note = body?.note ? String(body.note).trim() : null;
  const imageHash = normalizeImageHash(body?.imageHash);

  // Optional date fields (YYYY-MM-DD). Anything malformed becomes null.
  const asDate = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const sentAt = asDate(body?.sentAt);
  const arrivedAt = asDate(body?.arrivedAt);

  if (!imageUrl || !recipientName) {
    return NextResponse.json(
      { error: "图片和收件人姓名为必填项" },
      { status: 400 }
    );
  }
  if (!/^https:\/\/[^\s]+/.test(imageUrl)) {
    return NextResponse.json({ error: "图片地址无效" }, { status: 400 });
  }
  if (pickupLocation && pickupLocation.length > 80) {
    return NextResponse.json({ error: "取件地点过长" }, { status: 400 });
  }

  const canStoreMetadata = await ensurePostcardMetadataColumns();
  const canStoreHash = imageHash ? await ensureImageHashColumn() : false;
  let result;

  if (canStoreHash && canStoreMetadata) {
    result = await pool.query(
      `
      insert into postcards (image_url, recipient_name, image_hash, pickup_location, note, sent_at, arrived_at, uploader_id, status)
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'available')
      returning *
      `,
      [imageUrl, recipientName, imageHash, pickupLocation, note, sentAt, arrivedAt, user.id]
    );
  } else if (canStoreHash) {
    result = await pool.query(
      `
      insert into postcards (image_url, recipient_name, image_hash, note, sent_at, arrived_at, uploader_id, status)
      values ($1, $2, $3, $4, $5, $6, $7, 'available')
      returning *
      `,
      [imageUrl, recipientName, imageHash, note, sentAt, arrivedAt, user.id]
    );
  } else if (canStoreMetadata) {
    result = await pool.query(
      `
      insert into postcards (image_url, recipient_name, pickup_location, note, sent_at, arrived_at, uploader_id, status)
      values ($1, $2, $3, $4, $5, $6, $7, 'available')
      returning *
      `,
      [imageUrl, recipientName, pickupLocation, note, sentAt, arrivedAt, user.id]
    );
  } else {
    result = await pool.query(
      `
      insert into postcards (image_url, recipient_name, note, sent_at, arrived_at, uploader_id, status)
      values ($1, $2, $3, $4, $5, $6, 'available')
      returning *
      `,
      [imageUrl, recipientName, note, sentAt, arrivedAt, user.id]
    );
  }

  return NextResponse.json({ postcard: result.rows[0] }, { status: 201 });
}
