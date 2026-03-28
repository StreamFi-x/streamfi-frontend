import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { paginationSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import {
  ensureRewardsSchema,
  syncRewardEventsForUser,
  type RewardEventRow,
} from "../_lib/db";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, paginationSchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { limit, cursor } = queryResult.data;

  try {
    await ensureRewardsSchema();
    await syncRewardEventsForUser(session.userId, session.wallet);

    const result = cursor
      ? await sql<RewardEventRow>`
          SELECT id, event_type, points, metadata, created_at
          FROM viewer_reward_events
          WHERE user_id = ${session.userId}
            AND created_at < (
              SELECT created_at
              FROM viewer_reward_events
              WHERE id = ${cursor}
              LIMIT 1
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit}
        `
      : await sql<RewardEventRow>`
          SELECT id, event_type, points, metadata, created_at
          FROM viewer_reward_events
          WHERE user_id = ${session.userId}
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit}
        `;

    const nextCursor =
      result.rows.length === limit ? result.rows[result.rows.length - 1].id : null;

    return NextResponse.json({
      events: result.rows.map(event => ({
        id: event.id,
        event_type: event.event_type,
        points: Number(event.points),
        metadata: event.metadata ?? null,
        created_at:
          event.created_at instanceof Date
            ? event.created_at.toISOString()
            : new Date(event.created_at).toISOString(),
      })),
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error("[routes-f/rewards/history] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
