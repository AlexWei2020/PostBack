import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureUserRecipientNamesColumn } from "@/lib/schema";

function normalizeNames(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 64))
    )
  ).slice(0, 20);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const ready = await ensureUserRecipientNamesColumn();
  if (!ready) return NextResponse.json({ error: "账户字段尚不可用" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const recipientNames = normalizeNames(body?.recipientNames);

  const result = await pool.query(
    "update users set recipient_names = $1 where id = $2 returning recipient_names",
    [recipientNames, user.id]
  );

  return NextResponse.json({ recipientNames: result.rows[0]?.recipient_names ?? [] });
}
