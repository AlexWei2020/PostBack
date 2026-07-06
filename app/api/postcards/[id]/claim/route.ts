import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/postcards/[id]/claim  -> claim an available postcard
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  // Atomic claim: only succeeds if still available.
  const result = await pool.query(
    `
    update postcards
    set status = 'claimed', claimer_id = $1, claimed_at = now()
    where id = $2 and status = 'available'
    returning *
    `,
    [user.id, id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "认领失败：明信片不存在或已被认领" },
      { status: 409 }
    );
  }

  return NextResponse.json({ postcard: result.rows[0] });
}

// DELETE /api/postcards/[id]/claim -> cancel own claim before/after receipt
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
    set status = 'available',
        claimer_id = null,
        claimed_at = null,
        received_at = null
    where id = $1
      and claimer_id = $2
      and status in ('claimed', 'received')
    returning *
    `,
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "取消认领失败：只有当前认领人可取消" },
      { status: 409 }
    );
  }

  return NextResponse.json({ postcard: result.rows[0] });
}
