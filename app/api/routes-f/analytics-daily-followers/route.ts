import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readFromReplica,
  ReplicaUnavailableError,
  replicaUnavailableResponse,
} from "@/lib/db/replica";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureDailyFollowersDependencies } from "./_lib/db";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;

const querySchema = z.object({
  channel: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(MAX_RANGE_DAYS).default(DEFAULT_RANGE_DAYS),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { channel, days } = queryResult.data;

  try {
    await ensureDailyFollowersDependencies();

    const result = await readFromReplica(
      "routes-f.analytics-daily-followers",
      async db => {
        const channelResult = await db`
          SELECT id FROM users WHERE id = ${channel} AND deleted_at IS NULL LIMIT 1
        `;

        if (channelResult.rows.length === 0) {
          return { status: 404 as const };
        }

        // Only the channel owner may view their own follower breakdown.
        if (channel !== session.userId) {
          return { status: 403 as const };
        }

        const dailyResult = await db<{
          bucket: string;
          new_followers: number;
          unfollowers: number;
          net_change: number;
        }>`
          SELECT
            TO_CHAR(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS bucket,
            COUNT(*) FILTER (WHERE event_type = 'follow')::int AS new_followers,
            COUNT(*) FILTER (WHERE event_type = 'unfollow')::int AS unfollowers,
            (COUNT(*) FILTER (WHERE event_type = 'follow') - COUNT(*) FILTER (WHERE event_type = 'unfollow'))::int AS net_change
          FROM route_f_follow_events
          WHERE creator_id = ${channel}
            AND occurred_at >= NOW() - (${days}::text || ' days')::interval
          GROUP BY date_trunc('day', occurred_at)
          ORDER BY date_trunc('day', occurred_at) ASC
        `;
        return { status: 200 as const, rows: dailyResult.rows };
      },
      { request: req }
    );

    if (result.status === 404) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    if (result.status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      channel,
      range_days: days,
      daily_followers: result.rows,
    });
  } catch (error) {
    if (error instanceof ReplicaUnavailableError) {
      return replicaUnavailableResponse();
    }
    console.error("[routes-f/analytics-daily-followers] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
