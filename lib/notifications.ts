import { sql } from "@vercel/postgres";
import { randomUUID } from "crypto";

export type NotificationType = "follow" | "live";

/**
 * Write a notification directly to the DB.
 * Call this from server-side code (Route Handlers, server actions) instead of
 * fetching /api/users/notifications over HTTP — self-referencing HTTP calls
 * inside Next.js Route Handlers are unreliable and can deadlock.
 */
export async function writeNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  text: string
): Promise<void> {
  const notification = {
    id: randomUUID(),
    type,
    title,
    text,
    read: false,
    created_at: new Date().toISOString(),
  };

  const result = await sql`
    UPDATE users
    SET notifications = COALESCE(notifications, ARRAY[]::jsonb[]) || ${JSON.stringify(notification)}::jsonb
    WHERE id = ${recipientId}::uuid
  `;

  if (result.rowCount === 0) {
    console.error(
      `[writeNotification] No user found with id=${recipientId} — notification not written`
    );
  }
}
