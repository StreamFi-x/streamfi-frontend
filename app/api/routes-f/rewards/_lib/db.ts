import { db, sql, type VercelPoolClient } from "@vercel/postgres";

export type RewardTier = "Bronze" | "Silver" | "Gold" | "Diamond";

export interface RewardDefinition {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export interface RewardEventRow {
  id: string;
  event_type: string;
  points: number;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
}

export const REWARD_CATALOG: RewardDefinition[] = [
  {
    id: "featured-chat-highlight",
    name: "Featured Chat Highlight",
    cost: 250,
    description: "Pin one of your chat messages during a live stream.",
  },
  {
    id: "creator-shoutout",
    name: "Creator Shoutout",
    cost: 500,
    description: "Redeem for a creator callout on a participating stream.",
  },
  {
    id: "vip-badge",
    name: "VIP Badge",
    cost: 1200,
    description: "Unlock a loyalty badge for your account.",
  },
];

function getQuery(client?: VercelPoolClient) {
  return client ? client.sql.bind(client) : sql;
}

function sumInsertedPoints(rows: Array<{ points: number | string }>) {
  return rows.reduce((total, row) => total + Number(row.points ?? 0), 0);
}

async function tableExists(tableName: string, client?: VercelPoolClient) {
  const query = getQuery(client);
  const result = await query<{ exists: string | null }>`
    SELECT to_regclass(${`public.${tableName}`})::text AS exists
  `;

  return Boolean(result.rows[0]?.exists);
}

export function getTier(points: number): RewardTier {
  if (points >= 20_000) {
    return "Diamond";
  }
  if (points >= 5_000) {
    return "Gold";
  }
  if (points >= 1_000) {
    return "Silver";
  }
  return "Bronze";
}

export function getRewardDefinition(rewardId: string) {
  return REWARD_CATALOG.find(reward => reward.id === rewardId) ?? null;
}

export async function ensureRewardsSchema(client?: VercelPoolClient) {
  const query = getQuery(client);

  await query`
    CREATE EXTENSION IF NOT EXISTS pgcrypto
  `;

  await query`
    CREATE TABLE IF NOT EXISTS viewer_reward_balances (
      user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      points_balance   INTEGER NOT NULL DEFAULT 0,
      lifetime_points  INTEGER NOT NULL DEFAULT 0,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await query`
    CREATE TABLE IF NOT EXISTS viewer_reward_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_key  TEXT NOT NULL UNIQUE,
      event_type  TEXT NOT NULL,
      points      INTEGER NOT NULL,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await query`
    CREATE INDEX IF NOT EXISTS viewer_reward_events_user_created
      ON viewer_reward_events (user_id, created_at DESC, id DESC)
  `;
}

export async function ensureRewardBalanceRow(
  userId: string,
  client?: VercelPoolClient
) {
  const query = getQuery(client);
  await query`
    INSERT INTO viewer_reward_balances (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;
}

async function applyEarnedPoints(
  userId: string,
  rows: Array<{ points: number | string }>,
  client?: VercelPoolClient
) {
  const earnedPoints = sumInsertedPoints(rows);
  if (earnedPoints <= 0) {
    return 0;
  }

  const query = getQuery(client);
  await query`
    UPDATE viewer_reward_balances
    SET
      points_balance = points_balance + ${earnedPoints},
      lifetime_points = lifetime_points + ${earnedPoints},
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
  `;

  return earnedPoints;
}

export async function syncRewardEventsForUser(
  userId: string,
  wallet: string | null,
  client?: VercelPoolClient
) {
  const query = getQuery(client);
  await ensureRewardBalanceRow(userId, client);

  if (await tableExists("stream_viewers", client)) {
    const watchEvents = await query<{ points: number }>`
      INSERT INTO viewer_reward_events (
        user_id,
        source_key,
        event_type,
        points,
        metadata,
        created_at
      )
      SELECT
        ${userId},
        'watch:' || sv.id::text,
        'watch',
        FLOOR(
          GREATEST(
            EXTRACT(EPOCH FROM (COALESCE(sv.left_at, CURRENT_TIMESTAMP) - sv.joined_at)),
            0
          ) / 60
        )::int,
        jsonb_build_object(
          'stream_session_id', sv.stream_session_id,
          'viewer_session_id', sv.session_id
        ),
        COALESCE(sv.left_at, sv.joined_at, sv.created_at)
      FROM stream_viewers sv
      WHERE sv.user_id = ${userId}
        AND FLOOR(
          GREATEST(
            EXTRACT(EPOCH FROM (COALESCE(sv.left_at, CURRENT_TIMESTAMP) - sv.joined_at)),
            0
          ) / 60
        )::int > 0
      ON CONFLICT (source_key) DO NOTHING
      RETURNING points
    `;
    await applyEarnedPoints(userId, watchEvents.rows, client);
  }

  if (await tableExists("chat_messages", client)) {
    const chatEvents = await query<{ points: number }>`
      WITH ranked_messages AS (
        SELECT
          cm.id,
          cm.stream_session_id,
          cm.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY cm.user_id, cm.stream_session_id
            ORDER BY cm.created_at ASC, cm.id ASC
          ) AS reward_rank
        FROM chat_messages cm
        WHERE cm.user_id = ${userId}
          AND cm.is_deleted = FALSE
          AND COALESCE(cm.message_type, 'message') IN ('message', 'emote')
      )
      INSERT INTO viewer_reward_events (
        user_id,
        source_key,
        event_type,
        points,
        metadata,
        created_at
      )
      SELECT
        ${userId},
        'chat:' || rm.id::text,
        'chat',
        10,
        jsonb_build_object(
          'chat_message_id', rm.id,
          'stream_session_id', rm.stream_session_id
        ),
        rm.created_at
      FROM ranked_messages rm
      WHERE rm.reward_rank <= 5
      ON CONFLICT (source_key) DO NOTHING
      RETURNING points
    `;
    await applyEarnedPoints(userId, chatEvents.rows, client);
  }

  if (wallet && (await tableExists("notifications", client))) {
    const tipEvents = await query<{ points: number }>`
      INSERT INTO viewer_reward_events (
        user_id,
        source_key,
        event_type,
        points,
        metadata,
        created_at
      )
      SELECT
        ${userId},
        'tip:' || n.id::text,
        'tip',
        100,
        jsonb_build_object(
          'notification_id', n.id,
          'payment_id', n.metadata ->> 'paymentId',
          'tx_hash', n.metadata ->> 'txHash',
          'amount', n.metadata ->> 'amount',
          'recipient_user_id', n.user_id
        ),
        n.created_at
      FROM notifications n
      WHERE n.type = 'tip_received'::notification_type
        AND n.metadata ->> 'senderWallet' = ${wallet}
      ON CONFLICT (source_key) DO NOTHING
      RETURNING points
    `;
    await applyEarnedPoints(userId, tipEvents.rows, client);
  }
}

export async function getRewardBalance(
  userId: string,
  client?: VercelPoolClient
) {
  const query = getQuery(client);
  const result = await query<{
    points_balance: number;
    lifetime_points: number;
  }>`
    SELECT points_balance, lifetime_points
    FROM viewer_reward_balances
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  const balance = result.rows[0] ?? { points_balance: 0, lifetime_points: 0 };
  const pointsBalance = Number(balance.points_balance ?? 0);

  return {
    pointsBalance,
    lifetimePoints: Number(balance.lifetime_points ?? 0),
    tier: getTier(pointsBalance),
  };
}

export async function withRewardsTransaction<T>(
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
