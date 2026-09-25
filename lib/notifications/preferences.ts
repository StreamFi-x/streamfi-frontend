import { sql } from "@vercel/postgres";
import type { Tx } from "@/lib/postgres-transaction";

/**
 * Notification preference model.
 * Persisted to user_preferences table.
 * Controls which notification types are sent via which channels.
 */
export interface NotificationPreferences {
  user_id: string;
  // In-app notifications
  notify_follow: boolean;
  notify_live: boolean;
  notify_tip_received: boolean;
  notify_new_subscriber: boolean;
  notify_clip_featured: boolean;
  notify_payment_confirmed: boolean;
  notify_system: boolean;
  // Email notifications
  email_notify_follow: boolean;
  email_notify_live: boolean;
  email_notify_tip_received: boolean;
  email_notify_new_subscriber: boolean;
  email_notify_clip_featured: boolean;
  email_notify_payment_confirmed: boolean;
  email_digest: boolean;
  // Global preferences
  unsubscribed_all: boolean;
  updated_at: string;
}

/**
 * Default preferences - all notifications enabled except email_digest
 */
export function getDefaultPreferences(userId: string): NotificationPreferences {
  return {
    user_id: userId,
    notify_follow: true,
    notify_live: true,
    notify_tip_received: true,
    notify_new_subscriber: true,
    notify_clip_featured: true,
    notify_payment_confirmed: true,
    notify_system: true,
    email_notify_follow: true,
    email_notify_live: false,
    email_notify_tip_received: true,
    email_notify_new_subscriber: false,
    email_notify_clip_featured: false,
    email_notify_payment_confirmed: true,
    email_digest: false,
    unsubscribed_all: false,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fetch user's notification preferences from database.
 * Returns defaults if user has no preferences set.
 */
export async function getNotificationPreferences(
  userId: string,
  executor: Tx = { sql }
): Promise<NotificationPreferences> {
  try {
    const result = await executor.sql`
      SELECT 
        user_id,
        COALESCE(notify_follow, true) AS notify_follow,
        COALESCE(notify_live, true) AS notify_live,
        COALESCE(notify_tip_received, true) AS notify_tip_received,
        COALESCE(notify_new_subscriber, true) AS notify_new_subscriber,
        COALESCE(notify_clip_featured, true) AS notify_clip_featured,
        COALESCE(notify_payment_confirmed, true) AS notify_payment_confirmed,
        COALESCE(notify_system, true) AS notify_system,
        COALESCE(email_notify_follow, true) AS email_notify_follow,
        COALESCE(email_notify_live, false) AS email_notify_live,
        COALESCE(email_notify_tip_received, true) AS email_notify_tip_received,
        COALESCE(email_notify_new_subscriber, false) AS email_notify_new_subscriber,
        COALESCE(email_notify_clip_featured, false) AS email_notify_clip_featured,
        COALESCE(email_notify_payment_confirmed, true) AS email_notify_payment_confirmed,
        COALESCE(email_digest, false) AS email_digest,
        COALESCE(unsubscribed_all, false) AS unsubscribed_all,
        COALESCE(updated_at, NOW()::text) AS updated_at
      FROM notification_preferences
      WHERE user_id = ${userId}::uuid
    `;

    if (result.rows.length === 0) {
      return getDefaultPreferences(userId);
    }

    return result.rows[0] as NotificationPreferences;
  } catch (error) {
    console.error("[getNotificationPreferences] error:", error);
    return getDefaultPreferences(userId);
  }
}

/**
 * Update user's notification preferences.
 * Partial updates - only specified fields are changed.
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, "user_id" | "updated_at">>,
  executor: Tx = { sql }
): Promise<NotificationPreferences> {
  try {
    // Build UPDATE SET clause dynamically
    const setClause: string[] = [];
    const values: (string | boolean | null)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "user_id" && key !== "updated_at") {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value as string | boolean | null);
        paramIndex++;
      }
    }

    setClause.push(`updated_at = NOW()::text`);
    values.push(userId);

    if (setClause.length === 1) {
      // No updates - just return current prefs
      return getNotificationPreferences(userId, executor);
    }

    const query = `
      INSERT INTO notification_preferences (user_id, ${Object.keys(updates).join(", ")}, updated_at)
      VALUES ($${paramIndex}::uuid, ${Array.from({ length: Object.keys(updates).length }, (_, i) => `$${i + 1}`).join(", ")}, NOW()::text)
      ON CONFLICT (user_id) DO UPDATE SET ${setClause.join(", ")}
      RETURNING *
    `;

    const result = await executor.sql(query, [userId, ...Object.values(updates)]);

    if (result.rows.length === 0) {
      return getNotificationPreferences(userId, executor);
    }

    return result.rows[0] as NotificationPreferences;
  } catch (error) {
    console.error("[updateNotificationPreferences] error:", error);
    return getNotificationPreferences(userId, executor);
  }
}

/**
 * Check if a specific notification type should be sent to a user (in-app channel).
 * Returns false if user is globally unsubscribed or has disabled this specific type.
 */
export async function shouldSendInAppNotification(
  userId: string,
  notificationType: "follow" | "live" | "tip_received" | "new_subscriber" | "clip_featured" | "payment_confirmed" | "system",
  executor: Tx = { sql }
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId, executor);

  if (prefs.unsubscribed_all) {
    return false;
  }

  const prefKey = `notify_${notificationType}` as keyof NotificationPreferences;
  return Boolean(prefs[prefKey]);
}

/**
 * Check if a specific notification type should be sent via email.
 */
export async function shouldSendEmailNotification(
  userId: string,
  notificationType: "follow" | "live" | "tip_received" | "new_subscriber" | "clip_featured" | "payment_confirmed",
  executor: Tx = { sql }
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId, executor);

  if (prefs.unsubscribed_all) {
    return false;
  }

  const prefKey = `email_notify_${notificationType}` as keyof NotificationPreferences;
  return Boolean(prefs[prefKey]);
}

/**
 * Global unsubscribe - disables all notifications for a user.
 */
export async function globalUnsubscribe(
  userId: string,
  executor: Tx = { sql }
): Promise<void> {
  await executor.sql`
    INSERT INTO notification_preferences (user_id, unsubscribed_all, updated_at)
    VALUES (${userId}::uuid, true, NOW()::text)
    ON CONFLICT (user_id) DO UPDATE SET unsubscribed_all = true, updated_at = NOW()::text
  `;
}

/**
 * Re-subscribe user to all notifications.
 */
export async function globalResubscribe(
  userId: string,
  executor: Tx = { sql }
): Promise<void> {
  await executor.sql`
    INSERT INTO notification_preferences (user_id, unsubscribed_all, updated_at)
    VALUES (${userId}::uuid, false, NOW()::text)
    ON CONFLICT (user_id) DO UPDATE SET unsubscribed_all = false, updated_at = NOW()::text
  `;
}
