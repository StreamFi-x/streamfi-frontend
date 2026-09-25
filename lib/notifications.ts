import { sql } from "@vercel/postgres";
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
 *
 * The element is validated against the notifications contract
 * (lib/db/jsonb-contracts.ts) before it is appended.
 */
export async function writeNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  text: string
): Promise<void> {
  const notification = buildNotification(type, title, text);

  const result = await sql`
    UPDATE users
    SET notifications = COALESCE(notifications, ARRAY[]::jsonb[]) || ${JSON.stringify(notification)}::jsonb
    WHERE id = ${recipientId}::uuid AND deleted_at IS NULL
  `;

  if (result.rowCount === 0) {
    console.error(
      `[writeNotification] No active user found with id=${recipientId} — notification not written`
    );
  }
}
