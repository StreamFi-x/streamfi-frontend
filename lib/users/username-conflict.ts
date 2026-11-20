import { sql } from "@vercel/postgres";
import type { PreparedUsername } from "@/lib/validation/username";

export type UsernameConflict = "exact" | "lookalike";

/**
 * Finds an existing account whose username is the same as, or visually
 * confusable with, the prepared one. Tombstoned accounts count: identifiers
 * stay reserved until the account is purged.
 *
 * Matches on the stored skeleton, and on the lowercased username so rows that
 * predate the skeleton column (ASCII usernames are their own skeleton) are
 * still protected.
 */
export async function findUsernameConflict(
  prepared: PreparedUsername,
  excludeUserId?: string
): Promise<UsernameConflict | null> {
  const { rows } = await sql`
    SELECT LOWER(username) AS username
    FROM users
    WHERE (
        username_skeleton = ${prepared.skeleton}
        OR LOWER(username) = ${prepared.skeleton}
        OR LOWER(username) = ${prepared.username}
      )
      AND (${excludeUserId ?? null}::uuid IS NULL OR id <> ${excludeUserId ?? null}::uuid)
    LIMIT 5
  `;

  if (rows.length === 0) {
    return null;
  }
  return rows.some(row => row.username === prepared.username)
    ? "exact"
    : "lookalike";
}

export const LOOKALIKE_USERNAME_MESSAGE =
  "Username is too similar to an existing username";
