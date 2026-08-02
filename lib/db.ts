import { Pool, types } from "pg";

// Return `date` columns (OID 1082) as plain "YYYY-MM-DD" strings instead of JS
// Date objects. Otherwise pg builds a Date at local midnight which, once JSON
// serialized to UTC, can shift the calendar day (e.g. Asia/Shanghai → -1 day).
types.setTypeParser(types.builtins.DATE, (value) => value);

// Reuse a single pool across hot reloads / serverless invocations.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

// On Vercel each serverless instance is short-lived and mostly handles one
// request at a time, so a large per-instance pool just wastes Postgres
// connection slots. Keep `max` small and let idle connections drop quickly.
//
// IMPORTANT (Supabase): point DATABASE_URL at the *transaction pooler* so many
// serverless instances share a small set of real Postgres connections instead
// of each opening its own:
//   postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
// node-postgres never uses server-side prepared statements here (we pass no
// query `name`), so it is compatible with the transaction (6543) pooler.
export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // 1 real connection per instance is plenty behind the shared pooler.
    max: 3,
    // Drop idle sockets fast so a frozen/idle function doesn't hold a slot.
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    // Let the Node process exit cleanly once all connections go idle.
    allowExitOnIdle: true,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});
