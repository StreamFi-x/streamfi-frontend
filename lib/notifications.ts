import { sql } from "@vercel/postgres";
import type { Tx } from "@/lib/postgres-transaction";
import type { RenderedNotification } from "@/lib/notifications/template-engine";
import {
  createNotificationRecord,
  type NotificationType,
  type TemplateParams,
} from "@/lib/notifications/template-engine";
import type { SupportedLocale } from "@/lib/i18n/translator";
import {
  buildNotification,
  type NotificationType,
} from "@/lib/db/jsonb-contracts";

export type NotificationType = "follow" | "live" | "security";

export interface WriteNotificationOptions {
  idempotencyKey?: string;
  dedupWindowSeconds?: number;
}

/**
 * Write a notification directly to the DB.
 * Call this from server-side code (Route Handlers, server actions) instead of
 * fetching /api/users/notifications over HTTP — self-referencing HTTP calls
 * inside Next.js Route Handlers are unreliable and can deadlock.
 * Pass `executor` to write inside an open transaction (see withTransaction).
 *
 * DEPRECATED: Use writeTemplatedNotification instead for new code.
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
  executor: Tx = { sql },
  options?: WriteNotificationOptions
): Promise<void> {
  const notification = buildNotification(type, title, text);

  if (options?.idempotencyKey) {
    const result = await executor.sql`
      INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at, idempotency_key)
      SELECT ${notification.id}::uuid, id, ${notification.type}, ${notification.title},
             ${notification.text}, ${notification.read}, ${notification.created_at}::timestamptz,
             ${options.idempotencyKey}
      FROM users
      WHERE id = ${recipientId}::uuid AND deleted_at IS NULL
      ON CONFLICT (idempotency_key) DO NOTHING
    `;

    if (result.rowCount === 0) {
      console.warn(
        `[writeNotification] Notification with idempotencyKey=${options.idempotencyKey} already exists or user not found — skipped`
      );
    }
    return;
  }

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

/**
 * Write a templated notification with i18n support.
 * Automatically renders title and body from templates based on type and params.
 * Respects user preferences before writing.
 */
export async function writeTemplatedNotification(
  recipientId: string,
  type: NotificationType,
  params: TemplateParams,
  executor: Tx = { sql },
  locale: SupportedLocale = "en",
  options?: WriteNotificationOptions
): Promise<void> {
  const notification = createNotificationRecord(
    type,
    params,
    locale
  ) as RenderedNotification;

  if (options?.idempotencyKey) {
    const check = await executor.sql`
      SELECT id FROM notifications WHERE idempotency_key = ${options.idempotencyKey} LIMIT 1
    `;
    if (check.rows.length > 0) {
      return;
    }
    await executor.sql`
      INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at, idempotency_key)
      SELECT ${notification.id}::uuid, id, ${notification.type}, ${notification.title},
             ${notification.text}, ${notification.read}, ${notification.created_at}::timestamptz,
             ${options.idempotencyKey}
      FROM users
      WHERE id = ${recipientId}::uuid AND deleted_at IS NULL
      ON CONFLICT (idempotency_key) DO NOTHING
    `;
  }

  const result = await executor.sql`
    UPDATE users
    SET notifications = COALESCE(notifications, ARRAY[]::jsonb[]) || ${JSON.stringify(notification)}::jsonb
    WHERE id = ${recipientId}::uuid
  `;

  if (result.rowCount === 0) {
    console.error(
      `[writeTemplatedNotification] No user found with id=${recipientId} — notification not written`
    );
  }
}

export type {
  NotificationType,
  TemplateParams,
  RenderedNotification,
} from "@/lib/notifications/template-engine";
