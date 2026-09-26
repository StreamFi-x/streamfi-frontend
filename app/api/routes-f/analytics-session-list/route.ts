/**
 * GET /api/routes-f/analytics-session-list?creator_id=<uuid>&limit=50&offset=0
 *
 * Returns paginated list of past stream sessions for a creator with summary analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readFromReplica,
  ReplicaUnavailableError,
  replicaUnavailableResponse,
} from "@/lib/db/replica";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { CACHE_POLICIES } from "@/lib/cache";

const querySchema = z.object({
  creator_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SessionListItem = {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  /** True when ended_at was estimated by session reconciliation (#1402). */
  ended_at_estimated: boolean;
  peak_viewers: number;
  total_unique_viewers: number;
  total_messages: number;
  has_retention_data: boolean;
};

export type SessionListResponse = {
  sessions: SessionListItem[];
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { creator_id, limit, offset } = queryResult.data;

  // Verify creator ownership
  if (creator_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { countRows, sessionRows } = await readFromReplica(
      "routes-f.analytics-session-list",
      async db => {
        // Get total count
        const { rows: countRows } = await db<{ count: number }>`
          SELECT COUNT(*) as count
          FROM stream_sessions
          WHERE user_id = ${creator_id}
        `;

        // Get paginated sessions
        const { rows: sessionRows } = await db<SessionListItem>`
          SELECT
            ss.id,
            ss.title,
            ss.started_at,
            ss.ended_at,
            ss.duration_seconds,
            (ss.end_source = 'reconciliation') IS TRUE AS ended_at_estimated,
            ss.peak_viewers,
            ss.total_unique_viewers,
            ss.total_messages,
            CASE
              WHEN EXISTS (
                SELECT 1 FROM route_f_session_retention
                WHERE session_id = ss.id LIMIT 1
              ) THEN true
              ELSE false
            END as has_retention_data
          FROM stream_sessions ss
          WHERE ss.user_id = ${creator_id}
          ORDER BY ss.started_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
        return { countRows, sessionRows };
      },
      { request: req }
    );

    const totalCount = countRows[0]?.count || 0;

    const response: SessionListResponse = {
      sessions: sessionRows,
      total_count: totalCount,
      limit,
      offset,
      has_more: offset + limit < totalCount,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": CACHE_POLICIES.privateAnalytics.cacheControl,
      },
    });
  } catch (error) {
    if (error instanceof ReplicaUnavailableError) {
      return replicaUnavailableResponse();
    }
    console.error("[analytics-session-list] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
