import { pool } from "@/lib/db";

const IMAGE_HASH_PART_RE = /^[0-9a-f]{16}$/i;
let imageHashColumnReady = false;

export function normalizeImageHash(value: unknown): string | null {
  const parts = typeof value === "string" ? value.trim().toLowerCase().split(":") : [];
  const hashes = parts.filter((part) => IMAGE_HASH_PART_RE.test(part)).slice(0, 4);
  return hashes.length > 0 ? hashes.join(":") : null;
}

export function hammingDistanceHex(a: string, b: string): number {
  const aParts = a.split(":").filter((part) => IMAGE_HASH_PART_RE.test(part));
  const bParts = b.split(":").filter((part) => IMAGE_HASH_PART_RE.test(part));
  if (aParts.length > 1 || bParts.length > 1) {
    return Math.min(
      ...aParts.flatMap((left) => bParts.map((right) => hammingDistanceHex(left, right)))
    );
  }

  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance += diff.toString(2).replaceAll("0", "").length;
  }
  return distance;
}

export async function ensureImageHashColumn() {
  if (imageHashColumnReady) return true;

  try {
    await pool.query("alter table public.postcards add column if not exists image_hash text");
    await pool.query(
      "create index if not exists postcards_image_hash_idx on public.postcards (image_hash)"
    );
    imageHashColumnReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure postcards.image_hash column:", err);
    return false;
  }
}
