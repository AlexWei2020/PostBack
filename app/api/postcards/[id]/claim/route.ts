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
