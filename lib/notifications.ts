import { sql } from "@vercel/postgres";
import type { Tx } from "@/lib/postgres-transaction";

export type NotificationType = "follow" | "live";

/**
 * Write a notification directly to the DB.
 * Call this from server-side code (Route Handlers, server actions) instead of
 * fetching /api/users/notifications over HTTP — self-referencing HTTP calls
 * inside Next.js Route Handlers are unreliable and can deadlock.
 * Pass `executor` to write inside an open transaction (see withTransaction).
 *
 * The INSERT selects the recipient row, so an unknown recipient inserts
 * nothing rather than raising a foreign-key error, which would abort the
 * caller's transaction.
 */
export async function writeNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  text: string,
  executor: Tx = { sql }
): Promise<void> {
  const result = await executor.sql`
    INSERT INTO notifications (user_id, type, title, body)
    SELECT id, ${type}, ${title}, ${text}
    FROM users
    WHERE id = ${recipientId}::uuid
  `;

  if (result.rowCount === 0) {
    console.error(
      `[writeNotification] No user found with id=${recipientId} — notification not written`
    );
  }
}
