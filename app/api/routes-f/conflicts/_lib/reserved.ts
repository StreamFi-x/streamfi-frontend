/**
 * Reserved and blocked username lists.
 *
 * Static lists cover well-known platform routes and brand terms.
 * The runtime `isBlocklisted()` helper also checks the DB for dynamically
 * managed offensive terms stored in the `username_blocklist` table.
 */

import { sql } from "@vercel/postgres";

/** Platform route names that cannot be used as usernames. */
const RESERVED_WORDS = new Set([
  "admin",
  "api",
  "dashboard",
  "settings",
  "explore",
  "browse",
  "onboarding",
  "login",
  "logout",
  "signup",
  "register",
  "profile",
  "search",
  "help",
  "support",
  "official",
  "streamfi",
  "about",
  "contact",
  "terms",
  "privacy",
  "status",
  "404",
  "500",
]);

/**
 * Returns 'reserved' if the username matches a platform route or brand term,
 * 'banned' if it appears in the DB blocklist, or null if it is clean.
 */
export async function classifyRestriction(
  username: string
): Promise<"reserved" | "banned" | null> {
  const lower = username.toLowerCase();

  if (RESERVED_WORDS.has(lower)) {
    return "reserved";
  }

  try {
    await ensureBlocklistTable();
    const { rows } = await sql`
      SELECT 1 FROM username_blocklist
      WHERE word = ${lower}
      LIMIT 1
    `;
    if (rows.length > 0) {return "banned";}
  } catch (err) {
    console.error("[conflicts] Error checking blocklist:", err);
    // Fail open — do not block a username because of a DB error
  }

  return null;
}

/** Ensures the DB-backed blocklist table exists. */
async function ensureBlocklistTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS username_blocklist (
      word TEXT PRIMARY KEY,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}
