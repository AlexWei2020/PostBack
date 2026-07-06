import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureImageHashColumn,
  hammingDistanceHex,
  normalizeImageHash,
} from "@/lib/postcard-image-hash";

const DUPLICATE_DISTANCE_THRESHOLD = 16;
const HASHED_SCAN_LIMIT = 300;
const UNHASHED_BACKFILL_LIMIT = 30;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const imageHash = normalizeImageHash(searchParams.get("hash"));
  if (!imageHash) {
    return NextResponse.json({ error: "图片指纹无效" }, { status: 400 });
  }

  const ready = await ensureImageHashColumn();
  if (!ready) {
    return NextResponse.json({ duplicates: [], unavailable: true });
  }

  const result = await pool.query(
    `
    select
      p.*,
      up.nickname as uploader_nickname,
      cl.nickname as claimer_nickname
    from postcards p
    left join users up on p.uploader_id = up.id
    left join users cl on p.claimer_id = cl.id
    where p.image_hash is not null
    order by p.created_at desc
    limit $1
    `,
    [HASHED_SCAN_LIMIT]
  );

  const unhashed = await pool.query(
    `
    select
      p.*,
      up.nickname as uploader_nickname,
      cl.nickname as claimer_nickname
    from postcards p
    left join users up on p.uploader_id = up.id
    left join users cl on p.claimer_id = cl.id
    where p.image_hash is null
    order by p.created_at desc
    limit $1
    `,
    [UNHASHED_BACKFILL_LIMIT]
  );

  const duplicates = result.rows
    .flatMap((postcard) => {
      const candidateHash = normalizeImageHash(postcard.image_hash);
      if (!candidateHash) return [];
      return [
        {
          postcard,
          distance: hammingDistanceHex(imageHash, candidateHash),
        },
      ];
    })
    .filter((item) => item.distance <= DUPLICATE_DISTANCE_THRESHOLD)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  return NextResponse.json({ duplicates, unhashedPostcards: unhashed.rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const ready = await ensureImageHashColumn();
  if (!ready) {
    return NextResponse.json({ ok: false, unavailable: true });
  }

  const body = await request.json().catch(() => ({}));
  const hashes = Array.isArray(body?.hashes) ? body.hashes.slice(0, 100) : [];
  let updated = 0;

  for (const item of hashes) {
    const id = typeof item?.id === "string" ? item.id : "";
    const imageHash = normalizeImageHash(item?.imageHash);
    if (!id || !imageHash) continue;

    const result = await pool.query(
      "update postcards set image_hash = $1 where id = $2 and image_hash is null",
      [imageHash, id]
    );
    updated += result.rowCount ?? 0;
  }

  return NextResponse.json({ ok: true, updated });
}
