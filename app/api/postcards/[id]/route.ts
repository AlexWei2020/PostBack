import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ensurePostcardMetadataColumns } from "@/lib/schema";

function asDate(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// PATCH /api/postcards/[id]
// 只有上传者本人可以修改自己上传的明信片记录。
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const recipientName = String(body?.recipientName || "").trim();
  const pickupLocation = body?.pickupLocation ? String(body.pickupLocation).trim() : null;
  const note = body?.note ? String(body.note).trim() : null;
  const sentAt = asDate(body?.sentAt);
  const arrivedAt = asDate(body?.arrivedAt);

  if (!recipientName) {
    return NextResponse.json({ error: "收件人姓名为必填项" }, { status: 400 });
  }
  if (recipientName.length > 64) {
    return NextResponse.json({ error: "收件人姓名过长" }, { status: 400 });
  }
  if (note && note.length > 500) {
    return NextResponse.json({ error: "备注过长" }, { status: 400 });
  }
  if (pickupLocation && pickupLocation.length > 80) {
    return NextResponse.json({ error: "取件地点过长" }, { status: 400 });
  }

  const canStoreMetadata = await ensurePostcardMetadataColumns();
  const result = await pool.query(
    canStoreMetadata
      ? `
      with updated as (
        update postcards
        set recipient_name = $1,
            pickup_location = $2,
            note = $3,
            sent_at = $4,
            arrived_at = $5
        where id = $6 and uploader_id = $7
        returning *
      )
      select
        updated.*,
        up.nickname as uploader_nickname,
        cl.nickname as claimer_nickname
      from updated
      left join users up on updated.uploader_id = up.id
      left join users cl on updated.claimer_id = cl.id
      `
      : `
      with updated as (
        update postcards
        set recipient_name = $1,
            note = $2,
            sent_at = $3,
            arrived_at = $4
        where id = $5 and uploader_id = $6
        returning *
      )
      select
        updated.*,
        up.nickname as uploader_nickname,
        cl.nickname as claimer_nickname
      from updated
      left join users up on updated.uploader_id = up.id
      left join users cl on updated.claimer_id = cl.id
      `,
    canStoreMetadata
      ? [recipientName, pickupLocation, note, sentAt, arrivedAt, id, user.id]
      : [recipientName, note, sentAt, arrivedAt, id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "修改失败：只有上传者本人可修改" },
      { status: 409 }
    );
  }

  return NextResponse.json({ postcard: result.rows[0] });
}

// DELETE /api/postcards/[id]
// 上传者本人可删除；认领者本人仍可在明信片已处于 received（已收到）状态时删除记录。
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const result = await pool.query(
    `
    delete from postcards
    where id = $1
      and (
        uploader_id = $2
        or (claimer_id = $2 and status = 'received')
      )
    returning image_url
    `,
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "删除失败：只有上传者本人，或已收到明信片的认领人可删除" },
      { status: 409 }
    );
  }

  // Best-effort：顺带清理 Blob 图片，失败不影响删除结果。
  const imageUrl = result.rows[0]?.image_url as string | undefined;
  if (imageUrl) {
    try {
      await del(imageUrl);
    } catch (err) {
      console.error("Blob del failed (ignored):", err);
    }
  }

  return NextResponse.json({ ok: true, id });
}
