import { Pool, types } from "pg";

// Return `date` columns (OID 1082) as plain "YYYY-MM-DD" strings instead of JS
// Date objects. Otherwise pg builds a Date at local midnight which, once JSON
// serialized to UTC, can shift the calendar day (e.g. Asia/Shanghai → -1 day).
types.setTypeParser(types.builtins.DATE, (value) => value);

// Reuse a single pool across hot reloads / serverless invocations.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});
