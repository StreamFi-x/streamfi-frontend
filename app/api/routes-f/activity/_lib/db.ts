import { sql } from "@vercel/postgres";
import type {
  ActivityEventRow,
  ActivityEventResponse,
  DailySummaryResponse,
  InsertActivityEventInput,
} from "./types";
import type { ActivityEventType } from "./types";
import { typesForFilter } from "./filters";
import type { ActivityFeedFilter } from "./types";

export async function ensureActivityEventsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS activity_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      type TEXT NOT NULL,
      actor_id UUID,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS activity_user_feed
    ON activity_events (user_id, created_at DESC)
  `;
}

export async function insertActivityEvent(
  input: InsertActivityEventInput
): Promise<{ id: string }> {
  await ensureActivityEventsTable();

  const metadata = JSON.stringify(input.metadata ?? {});
  const createdAt = input.createdAt ?? new Date().toISOString();

  const { rows } = await sql<{ id: string }>`
    INSERT INTO activity_events (user_id, type, actor_id, metadata, created_at)
    VALUES (
      ${input.userId},
      ${input.type},
      ${input.actorId ?? null},
      ${metadata}::jsonb,
      ${createdAt}
    )
    RETURNING id
  `;

  return { id: rows[0].id };
}

type FeedRow = ActivityEventRow & {
  actor_username: string | null;
  actor_avatar: string | null;
};

function mapFeedRow(row: FeedRow): ActivityEventResponse {
  return {
    id: row.id,
    type: row.type,
    actor:
      row.actor_id && row.actor_username
        ? { username: row.actor_username, avatar: row.actor_avatar }
        : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function fetchActivityFeed(params: {
  userId: string;
  limit: number;
  cursor?: string;
  filter: ActivityFeedFilter;
}): Promise<{ events: ActivityEventResponse[]; next_cursor: string | null }> {
  await ensureActivityEventsTable();

  const typeFilter = typesForFilter(params.filter);
  const fetchLimit = params.limit + 1;

  let rows: FeedRow[];

  if (params.cursor && typeFilter) {
    const { rows: result } = await sql<FeedRow>`
      SELECT
        ae.id,
        ae.user_id,
        ae.type,
        ae.actor_id,
        ae.metadata,
        ae.created_at,
        u.username AS actor_username,
        u.avatar AS actor_avatar
      FROM activity_events ae
      LEFT JOIN users u ON u.id = ae.actor_id
      WHERE ae.user_id = ${params.userId}
        AND ae.created_at < ${params.cursor}
        AND ae.type = ANY(${typeFilter}::text[])
      ORDER BY ae.created_at DESC
      LIMIT ${fetchLimit}
    `;
    rows = result;
  } else if (params.cursor) {
    const { rows: result } = await sql<FeedRow>`
      SELECT
        ae.id,
        ae.user_id,
        ae.type,
        ae.actor_id,
        ae.metadata,
        ae.created_at,
        u.username AS actor_username,
        u.avatar AS actor_avatar
      FROM activity_events ae
      LEFT JOIN users u ON u.id = ae.actor_id
      WHERE ae.user_id = ${params.userId}
        AND ae.created_at < ${params.cursor}
      ORDER BY ae.created_at DESC
      LIMIT ${fetchLimit}
    `;
    rows = result;
  } else if (typeFilter) {
    const { rows: result } = await sql<FeedRow>`
      SELECT
        ae.id,
        ae.user_id,
        ae.type,
        ae.actor_id,
        ae.metadata,
        ae.created_at,
        u.username AS actor_username,
        u.avatar AS actor_avatar
      FROM activity_events ae
      LEFT JOIN users u ON u.id = ae.actor_id
      WHERE ae.user_id = ${params.userId}
        AND ae.type = ANY(${typeFilter}::text[])
      ORDER BY ae.created_at DESC
      LIMIT ${fetchLimit}
    `;
    rows = result;
  } else {
    const { rows: result } = await sql<FeedRow>`
      SELECT
        ae.id,
        ae.user_id,
        ae.type,
        ae.actor_id,
        ae.metadata,
        ae.created_at,
        u.username AS actor_username,
        u.avatar AS actor_avatar
      FROM activity_events ae
      LEFT JOIN users u ON u.id = ae.actor_id
      WHERE ae.user_id = ${params.userId}
      ORDER BY ae.created_at DESC
      LIMIT ${fetchLimit}
    `;
    rows = result;
  }

  const hasMore = rows.length > params.limit;
  const page = hasMore ? rows.slice(0, params.limit) : rows;
  const events = page.map(mapFeedRow);
  const next_cursor =
    hasMore && page.length > 0
      ? events[events.length - 1].created_at
      : null;

  return { events, next_cursor };
}

export async function fetchDailySummary(
  userId: string,
  date: string
): Promise<DailySummaryResponse> {
  await ensureActivityEventsTable();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { rows } = await sql<{
    type: ActivityEventType;
    metadata: Record<string, unknown> | null;
  }>`
    SELECT type, metadata
    FROM activity_events
    WHERE user_id = ${userId}
      AND created_at >= ${dayStart}
      AND created_at <= ${dayEnd}
  `;

  let tips_received = 0;
  let followers_gained = 0;
  let stream_duration_seconds = 0;
  let peak_viewers = 0;

  for (const row of rows) {
    const meta = (row.metadata as Record<string, unknown>) ?? {};

    if (row.type === "tip_received") {
      tips_received += 1;
    }

    if (row.type === "new_follower") {
      followers_gained += 1;
    }

    if (row.type === "stream_ended") {
      const duration = Number(meta.duration_seconds ?? 0);
      if (!Number.isNaN(duration)) {
        stream_duration_seconds += duration;
      }
      const peak = Number(meta.peak_viewers ?? 0);
      if (!Number.isNaN(peak)) {
        peak_viewers = Math.max(peak_viewers, peak);
      }
    }

    if (row.type === "stream_started") {
      const peak = Number(meta.peak_viewers ?? 0);
      if (!Number.isNaN(peak)) {
        peak_viewers = Math.max(peak_viewers, peak);
      }
    }
  }

  return {
    date,
    tips_received,
    followers_gained,
    stream_duration_seconds,
    peak_viewers,
  };
}
