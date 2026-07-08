import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ensurePostcardHiddenColumn } from "@/lib/schema";

// 认领人对自己认领/已收到的明信片切换「隐藏」。
// 隐藏后广场对所有人不可见，认领人仍能在「我的」看到。
async function setHidden(
  id: string,
  userId: string,
  hidden: boolean
): Promise<{ ok: boolean; postcard?: unknown }> {
  const ready = await ensurePostcardHiddenColumn();
  if (!ready) return { ok: false };

  const result = await pool.query(
    `
    update postcards
    set hidden_by_claimer = $3
    where id = $1 and claimer_id = $2 and status in ('claimed', 'received')
    returning *
    `,
    [id, userId, hidden]
  );
  if (result.rows.length === 0) return { ok: false };
  return { ok: true, postcard: result.rows[0] };
}

// POST -> 隐藏
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { ok, postcard } = await setHidden(id, user.id, true);
  if (!ok) {
    return NextResponse.json(
      { error: "隐藏失败：只有认领人可隐藏自己认领的明信片" },
      { status: 409 }
    );
  }
  return NextResponse.json({ postcard });
}

// DELETE -> 取消隐藏
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { ok, postcard } = await setHidden(id, user.id, false);
  if (!ok) {
    return NextResponse.json(
      { error: "取消隐藏失败：只有认领人可操作" },
      { status: 409 }
    );
  }
  return NextResponse.json({ postcard });
}
