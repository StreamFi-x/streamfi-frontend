import { db, sql, type VercelPoolClient } from "@vercel/postgres";
import { sendTipReceivedNotificationEmail } from "@/lib/notification-email";
import {
  defaultNotificationPreferences,
  notificationPreferenceKeyByType,
  type Notification,
  type NotificationCursor,
  type NotificationMetadata,
  type NotificationPreferences,
  type NotificationType,
} from "@/types/notifications";

type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: unknown;
  read: boolean;
  created_at: string | Date;
};

interface UserNotificationSettingsRow {
  email: string | null;
  username: string | null;
  emailnotifications: boolean | null;
  notification_preferences: unknown;
}

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: NotificationMetadata | null;
  dedupeKey?: string | null;
  client?: VercelPoolClient;
}

interface CreateLiveNotificationsForFollowersInput {
  creatorId: string;
  creatorUsername: string;
  playbackId?: string | null;
  dedupeKey: string;
  client?: VercelPoolClient;
}

interface CreateTipNotificationInput {
  userId: string;
  amount: string;
  senderLabel: string;
  senderWallet?: string | null;
  txHash: string;
  paymentId: string;
  client?: VercelPoolClient;
}

interface CreateRecordingReadyNotificationInput {
  userId: string;
  title: string;
  recordingId: string;
  playbackId: string;
  client?: VercelPoolClient;
}

function getQuery(client?: VercelPoolClient) {
  return client ? client.sql.bind(client) : sql;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeNotificationPreferences(
  raw: unknown,
  emailNotificationsFallback = true
): NotificationPreferences {
  const source = isRecord(raw) ? raw : {};

  return {
    newFollower: readBoolean(
      source.newFollower,
      defaultNotificationPreferences.newFollower
    ),
    tipReceived: readBoolean(
      source.tipReceived,
      defaultNotificationPreferences.tipReceived
    ),
    streamLive: readBoolean(
      source.streamLive,
      defaultNotificationPreferences.streamLive
    ),
    recordingReady: readBoolean(
      source.recordingReady,
      defaultNotificationPreferences.recordingReady
    ),
    emailNotifications: readBoolean(
      source.emailNotifications,
      emailNotificationsFallback
    ),
  };
}

function normalizeNotificationMetadata(
  metadata: unknown
): NotificationMetadata | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const normalized = Object.entries(metadata).reduce<NotificationMetadata>(
    (accumulator, [key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        accumulator[key] = value;
      }

      return accumulator;
    },
    {}
  );

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    metadata: normalizeNotificationMetadata(row.metadata),
    read: row.read,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  };
}

async function getUserNotificationSettings(
  userId: string,
  client?: VercelPoolClient
): Promise<UserNotificationSettingsRow | null> {
  const query = getQuery(client);
  const result = await query<UserNotificationSettingsRow>`
    SELECT email, username, emailnotifications, notification_preferences
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return result.rows[0] ?? null;
}

async function maybeSendTipNotificationEmail(
  settings: UserNotificationSettingsRow,
  notification: Notification
) {
  const preferences = normalizeNotificationPreferences(
    settings.notification_preferences,
    settings.emailnotifications ?? true
  );

  if (!preferences.emailNotifications || !settings.email) {
    return;
  }

  const amount = notification.metadata?.amount;
  const senderLabel =
    notification.metadata?.senderWallet || notification.body || "Someone";

  if (!amount) {
    return;
  }

  void sendTipReceivedNotificationEmail({
    email: settings.email,
    username: settings.username ?? "there",
    amount,
    senderLabel,
  }).catch(error => {
    console.error("[notifications] Failed to send tip email:", error);
  });
}

export async function withNotificationTransaction<T>(
  callback: (client: VercelPoolClient) => Promise<T>
) {
  const client = await db.connect();

  try {
    await client.sql`BEGIN`;
    const result = await callback(client);
    await client.sql`COMMIT`;
    return result;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }
}

export async function getNotificationPreferences(userId: string) {
  const settings = await getUserNotificationSettings(userId);

  if (!settings) {
    return defaultNotificationPreferences;
  }

  return normalizeNotificationPreferences(
    settings.notification_preferences,
    settings.emailnotifications ?? true
  );
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
) {
  const current = await getNotificationPreferences(userId);
  const nextPreferences = {
    ...current,
    ...preferences,
  };

  await sql`
    UPDATE users
    SET
      notification_preferences = ${JSON.stringify(nextPreferences)}::jsonb,
      emailnotifications = ${nextPreferences.emailNotifications},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;

  return nextPreferences;
}

export async function listNotifications(userId: string, limit = 50) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const [notificationsResult, unreadCountResult] = await Promise.all([
    sql<NotificationRow>`
      SELECT id, user_id, type, title, body, metadata, read, created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit}
    `,
    sql<{ unread_count: number }>`
      SELECT COUNT(*)::int AS unread_count
      FROM notifications
      WHERE user_id = ${userId} AND read = false
    `,
  ]);

  return {
    notifications: notificationsResult.rows.map(mapNotification),
    unreadCount: unreadCountResult.rows[0]?.unread_count ?? 0,
  };
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string
) {
  const result = await sql<NotificationRow>`
    UPDATE notifications
    SET read = true
    WHERE id = ${notificationId} AND user_id = ${userId}
    RETURNING id, user_id, type, title, body, metadata, read, created_at
  `;

  return result.rows[0] ? mapNotification(result.rows[0]) : null;
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await sql`
    UPDATE notifications
    SET read = true
    WHERE user_id = ${userId} AND read = false
  `;

  return result.rowCount ?? 0;
}

export async function deleteNotification(
  userId: string,
  notificationId: string
) {
  const result = await sql`
    DELETE FROM notifications
    WHERE id = ${notificationId} AND user_id = ${userId}
  `;

  return (result.rowCount ?? 0) > 0;
}

export async function listUnreadNotificationsSince(
  userId: string,
  cursor: NotificationCursor,
  limit = 50
) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const result = await sql<NotificationRow>`
    SELECT id, user_id, type, title, body, metadata, read, created_at
    FROM notifications
    WHERE user_id = ${userId}
      AND read = false
      AND (
        created_at > ${cursor.createdAt}::timestamptz
        OR (
          created_at = ${cursor.createdAt}::timestamptz
          AND id > ${cursor.id}::uuid
        )
      )
    ORDER BY created_at ASC, id ASC
    LIMIT ${safeLimit}
  `;

  return result.rows.map(mapNotification);
}

export async function createNotification({
  userId,
  type,
  title,
  body = null,
  metadata = null,
  dedupeKey = null,
  client,
}: CreateNotificationInput) {
  const settings = await getUserNotificationSettings(userId, client);

  if (!settings) {
    return null;
  }

  const preferences = normalizeNotificationPreferences(
    settings.notification_preferences,
    settings.emailnotifications ?? true
  );
  const preferenceKey = notificationPreferenceKeyByType[type];

  if (preferenceKey && !preferences[preferenceKey]) {
    return null;
  }

  const query = getQuery(client);
  const result = dedupeKey
    ? await query<NotificationRow>`
        INSERT INTO notifications (user_id, type, title, body, metadata, dedupe_key)
        VALUES (
          ${userId},
          ${type}::notification_type,
          ${title},
          ${body},
          ${metadata ? JSON.stringify(metadata) : null}::jsonb,
          ${dedupeKey}
        )
        ON CONFLICT (user_id, dedupe_key) DO NOTHING
        RETURNING id, user_id, type, title, body, metadata, read, created_at
      `
    : await query<NotificationRow>`
        INSERT INTO notifications (user_id, type, title, body, metadata)
        VALUES (
          ${userId},
          ${type}::notification_type,
          ${title},
          ${body},
          ${metadata ? JSON.stringify(metadata) : null}::jsonb
        )
        RETURNING id, user_id, type, title, body, metadata, read, created_at
      `;

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const notification = mapNotification(row);

  if (type === "tip_received") {
    await maybeSendTipNotificationEmail(settings, notification);
  }

  return notification;
}

export async function createLiveNotificationsForFollowers({
  creatorId,
  creatorUsername,
  playbackId,
  dedupeKey,
  client,
}: CreateLiveNotificationsForFollowersInput) {
  const query = getQuery(client);
  const streamUrl = `/${creatorUsername}/watch`;
  const result = await query`
    INSERT INTO notifications (user_id, type, title, body, metadata, dedupe_key)
    SELECT
      uf.follower_id,
      'stream_live'::notification_type,
      ${`${creatorUsername} is live!`},
      ${`${creatorUsername} just started streaming`},
      jsonb_build_object(
        'username', ${creatorUsername},
        'playbackId', ${playbackId ?? null},
        'url', ${streamUrl}
      ),
      ${dedupeKey}
    FROM user_follows uf
    JOIN users follower ON follower.id = uf.follower_id
    WHERE uf.followee_id = ${creatorId}
      AND COALESCE((follower.notification_preferences ->> 'streamLive')::boolean, true) = true
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
  `;

  return result.rowCount ?? 0;
}

export async function createTipReceivedNotification({
  userId,
  amount,
  senderLabel,
  senderWallet,
  txHash,
  paymentId,
  client,
}: CreateTipNotificationInput) {
  return createNotification({
    userId,
    type: "tip_received",
    title: "New tip received",
    body: `${senderLabel} sent you ${amount} XLM`,
    metadata: {
      amount,
      senderWallet: senderWallet ?? undefined,
      txHash,
      paymentId,
      url: "/dashboard/payout",
    },
    dedupeKey: `tip:${paymentId}`,
    client,
  });
}

export async function createRecordingReadyNotification({
  userId,
  title,
  recordingId,
  playbackId,
  client,
}: CreateRecordingReadyNotificationInput) {
  return createNotification({
    userId,
    type: "recording_ready",
    title,
    body: "Your latest stream recording is ready to watch.",
    metadata: {
      recordingId,
      recordingPlaybackId: playbackId,
      url: "/dashboard/recordings",
    },
    dedupeKey: `recording:${recordingId}`,
    client,
  });
}

export async function writeNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: NotificationMetadata | null,
  dedupeKey?: string | null
) {
  return createNotification({
    userId: recipientId,
    type,
    title,
    body,
    metadata,
    dedupeKey,
  });
}
