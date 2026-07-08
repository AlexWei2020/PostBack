import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bumpReceivedCount } from "@/lib/schema";

// POST /api/postcards/[id]/receive -> confirm receipt (claimer only)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const result = await pool.query(
    `
    update postcards
    set status = 'received', received_at = now()
    where id = $1 and claimer_id = $2 and status = 'claimed'
    returning *
    `,
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "操作失败：只有认领人可确认收货，且需处于已认领状态" },
      { status: 409 }
    );
  }

  await bumpReceivedCount(1); // 累计签收 +1
  return NextResponse.json({ postcard: result.rows[0] });
}

// DELETE /api/postcards/[id]/receive -> undo own receipt confirmation
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const result = await pool.query(
    `
    update postcards
    set status = 'claimed', received_at = null
    where id = $1 and claimer_id = $2 and status = 'received'
    returning *
    `,
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "取消签收失败：只有认领人可取消自己的签收" },
      { status: 409 }
    );
  }

  await bumpReceivedCount(-1); // 取消签收 -1
  return NextResponse.json({ postcard: result.rows[0] });
}
