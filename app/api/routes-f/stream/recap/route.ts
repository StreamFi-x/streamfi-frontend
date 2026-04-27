import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const recapQuerySchema = z.object({
  stream_id: z.string().uuid(),
});

type StreamRow = {
  id: string;
  user_id: string;
  peak_viewers: number | null;
  total_messages: number | null;
  started_at: string;
  ended_at: string | null;
};

type RecapPayload = {
  stream_id: string;
  peak_viewers: number;
  avg_viewers: number;
  total_watch_minutes: number;
  total_tips_received: string;
  new_followers: number;
  top_gifters: Array<{
    supporter_id: string;
    username: string | null;
    avatar: string | null;
    total_amount_usdc: string;
  }>;
  chat_message_count: number;
  stream_duration_seconds: number;
  generated_at: string;
};

async function ensureRecapTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_recaps (
      stream_id UUID PRIMARY KEY REFERENCES stream_sessions(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recap JSONB NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_recaps_creator_updated
    ON stream_recaps (creator_id, updated_at DESC)
  `;
}

function secondsBetween(startedAt: string, endedAt: string): number {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / 1000);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    recapQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { stream_id } = queryResult.data;

  try {
    await ensureRecapTable();

    const { rows: streamRows } = await sql<StreamRow>`
      SELECT id, user_id, peak_viewers, total_messages, started_at, ended_at
      FROM stream_sessions
      WHERE id = ${stream_id}
      LIMIT 1
    `;

    if (streamRows.length === 0 || !streamRows[0].ended_at) {
      return NextResponse.json(
        { error: "Completed stream not found" },
        { status: 404 }
      );
    }

    const stream = streamRows[0];
    const endedAt = String(stream.ended_at);

    const { rows: cachedRows } = await sql<{ recap: RecapPayload }>`
      SELECT recap
      FROM stream_recaps
      WHERE stream_id = ${stream.id}
      LIMIT 1
    `;

    if (cachedRows.length > 0) {
      return NextResponse.json(cachedRows[0].recap, {
        headers: { "Cache-Control": "public, max-age=86400" },
      });
    }

    const streamDurationSeconds = secondsBetween(stream.started_at, endedAt);

    const [watchResult, tipResult, followerResult, gifterResult, chatResult] =
      await Promise.all([
        sql<{ watch_seconds: string | null }>`
        SELECT COALESCE(
          SUM(
            GREATEST(
              0,
              EXTRACT(
                EPOCH FROM (
                  LEAST(COALESCE(left_at, ${endedAt}), ${endedAt})
                  - GREATEST(joined_at, ${stream.started_at})
                )
              )
            )
          ),
          0
        ) AS watch_seconds
        FROM stream_viewers
        WHERE stream_session_id = ${stream.id}
          AND joined_at < ${endedAt}
      `,
        sql<{ total_tips_received: string | null }>`
        SELECT COALESCE(SUM(amount_xlm), 0)::text AS total_tips_received
        FROM tip_transactions
        WHERE creator_id = ${stream.user_id}
          AND created_at >= ${stream.started_at}
          AND created_at <= ${endedAt}
      `,
        sql<{ new_followers: number | null }>`
        SELECT COUNT(*)::int AS new_followers
        FROM user_follows
        WHERE followee_id = ${stream.user_id}
          AND created_at >= ${stream.started_at}
          AND created_at <= ${endedAt}
      `,
        sql<{
          supporter_id: string;
          username: string | null;
          avatar: string | null;
          total_amount_usdc: string;
        }>`
        SELECT
          gt.supporter_id,
          u.username,
          u.avatar,
          COALESCE(SUM(gt.amount_usdc), 0)::text AS total_amount_usdc
        FROM gift_transactions gt
        LEFT JOIN users u ON u.id = gt.supporter_id
        WHERE gt.creator_id = ${stream.user_id}
          AND gt.created_at >= ${stream.started_at}
          AND gt.created_at <= ${endedAt}
          AND gt.supporter_id IS NOT NULL
        GROUP BY gt.supporter_id, u.username, u.avatar
        ORDER BY COALESCE(SUM(gt.amount_usdc), 0) DESC, gt.supporter_id ASC
        LIMIT 5
      `,
        sql<{ chat_count: number | null }>`
        SELECT COUNT(*)::int AS chat_count
        FROM chat_messages
        WHERE stream_session_id = ${stream.id}
          AND is_deleted = false
      `,
      ]);

    const watchRows = watchResult.rows;
    const tipRows = tipResult.rows;
    const followerRows = followerResult.rows;
    const gifterRows = gifterResult.rows;
    const chatRows = chatResult.rows;

    const watchSeconds = Number(watchRows[0]?.watch_seconds ?? 0);
    const totalWatchMinutes = Math.round(watchSeconds / 60);

    const avgViewers =
      streamDurationSeconds > 0
        ? Number((watchSeconds / streamDurationSeconds).toFixed(2))
        : 0;

    const recap: RecapPayload = {
      stream_id: stream.id,
      peak_viewers: Number(stream.peak_viewers ?? 0),
      avg_viewers: avgViewers,
      total_watch_minutes: totalWatchMinutes,
      total_tips_received: tipRows[0]?.total_tips_received ?? "0",
      new_followers: Number(followerRows[0]?.new_followers ?? 0),
      top_gifters: gifterRows,
      chat_message_count: Number(
        stream.total_messages ?? chatRows[0]?.chat_count ?? 0
      ),
      stream_duration_seconds: streamDurationSeconds,
      generated_at: new Date().toISOString(),
    };

    await sql`
      INSERT INTO stream_recaps (stream_id, creator_id, recap, generated_at, updated_at)
      VALUES (${stream.id}, ${stream.user_id}, ${JSON.stringify(recap)}::jsonb, NOW(), NOW())
      ON CONFLICT (stream_id) DO UPDATE SET
        recap = EXCLUDED.recap,
        updated_at = NOW()
    `;

    return NextResponse.json(recap, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (error) {
    console.error("[routes-f stream recap GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch stream recap" },
      { status: 500 }
    );
  }
}
