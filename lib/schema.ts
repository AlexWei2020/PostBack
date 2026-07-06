import { pool } from "@/lib/db";

let postcardMetadataReady = false;
let userRecipientNamesReady = false;

export async function ensurePostcardMetadataColumns() {
  if (postcardMetadataReady) return true;
  try {
    await pool.query("alter table public.postcards add column if not exists pickup_location text");
    postcardMetadataReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure postcard metadata columns:", err);
    return false;
  }
}

export async function ensureUserRecipientNamesColumn() {
  if (userRecipientNamesReady) return true;
  try {
    await pool.query(
      "alter table public.users add column if not exists recipient_names text[] not null default '{}'"
    );
    userRecipientNamesReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure users.recipient_names column:", err);
    return false;
  }
}
