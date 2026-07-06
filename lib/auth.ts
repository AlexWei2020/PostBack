import { cookies } from "next/headers";
import { pool } from "./db";

export type CurrentUser = {
  id: string;
  geekpie_id: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
};

/**
 * Reads the `session` cookie and returns the matching, non-expired user.
 * Returns null when there is no valid session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (!sessionCookie) return null;

  const result = await pool.query(
    `
    select users.*
    from sessions
    join users on sessions.user_id = users.id
    where sessions.id = $1
      and sessions.expires_at > now()
    `,
    [sessionCookie.value]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0] as CurrentUser;
}
