/**
 * Nightly cron: delete expired user_sessions rows.
 *
 * Run via your scheduler (Vercel Cron, GitHub Actions, etc.) once per day.
 * Example cron expression: "0 3 * * *" (03:00 UTC daily)
 *
 * Usage:
 *   npx tsx scripts/cron-cleanup-sessions.ts
 *
 * Required env vars (same as the app):
 *   POSTGRES_URL  (or DATABASE_URL — whichever @vercel/postgres picks up)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { sql } from "@vercel/postgres";

async function cleanupExpiredSessions(): Promise<void> {
  console.log("[cron-cleanup-sessions] Starting cleanup…");

  try {
    const result = await sql`
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
         OR revoked = true
    `;

    const deleted = result.rowCount ?? 0;
    console.log(
      `[cron-cleanup-sessions] Deleted ${deleted} expired/revoked session(s).`
    );
  } catch (err) {
    console.error("[cron-cleanup-sessions] Error:", err);
    process.exit(1);
  }
}

cleanupExpiredSessions().then(() => {
  console.log("[cron-cleanup-sessions] Done.");
  process.exit(0);
});
