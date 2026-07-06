import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/postcards/[id]
// 只有「认领人本人」且明信片已处于 received（已收到）状态时可删除记录。
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
    where id = $1 and claimer_id = $2 and status = 'received'
    returning image_url
    `,
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "删除失败：只有认领人本人在已收到后可删除" },
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
