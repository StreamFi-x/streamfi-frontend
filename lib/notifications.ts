import { sql } from "@vercel/postgres";
import type { Tx } from "@/lib/postgres-transaction";
import {
  buildNotification,
  type NotificationType,
} from "@/lib/db/jsonb-contracts";

export type { NotificationType };

/**
 * Write a notification directly to the DB.
 * Call this from server-side code (Route Handlers, server actions) instead of
 * fetching /api/users/notifications over HTTP — self-referencing HTTP calls
 * inside Next.js Route Handlers are unreliable and can deadlock.
 * Pass `executor` to write inside an open transaction (see withTransaction).
 *
 * The notification is validated against the notifications contract
 * (lib/db/jsonb-contracts.ts; throws JsonbContractError) and stored as a row
 * of the notifications table. The INSERT selects the recipient row, so an
 * unknown or deleted recipient inserts nothing rather than raising a
 * foreign-key error, which would abort the caller's transaction.
 */
export async function writeNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  text: string,
  executor: Tx = { sql }
): Promise<void> {
  const notification = buildNotification(type, title, text);

  const result = await executor.sql`
    INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at)
    SELECT ${notification.id}::uuid, id, ${notification.type}, ${notification.title},
           ${notification.text}, ${notification.read}, ${notification.created_at}::timestamptz
    FROM users
    WHERE id = ${recipientId}::uuid AND deleted_at IS NULL
  `;

  if (result.rowCount === 0) {
    console.error(
      `[writeNotification] No active user found with id=${recipientId} — notification not written`
    );
  }
}
