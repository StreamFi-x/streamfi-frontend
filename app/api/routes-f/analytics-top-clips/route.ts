import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readFromReplica,
  ReplicaUnavailableError,
  replicaUnavailableResponse,
} from "@/lib/db/replica";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureTopClipsDependencies } from "./_lib/db";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const querySchema = z.object({
  channel: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(MAX_RANGE_DAYS).default(DEFAULT_RANGE_DAYS),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
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

  const { channel, days, limit } = queryResult.data;

  try {
    await ensureTopClipsDependencies();

    const result = await readFromReplica(
      "routes-f.analytics-top-clips",
      async db => {
        const channelResult = await db`
          SELECT id FROM users WHERE id = ${channel} LIMIT 1
        `;

        if (channelResult.rows.length === 0) {
          return { status: 404 as const };
        }

        // Only the channel owner may view their own top-clips breakdown.
        if (channel !== session.userId) {
          return { status: 403 as const };
        }

        const clipsResult = await db<{
          id: string;
          title: string;
          view_count: number;
          created_at: string;
        }>`
          SELECT id, title, view_count, created_at
          FROM route_f_clips
          WHERE creator_id = ${channel}
            AND created_at >= NOW() - (${days}::text || ' days')::interval
          ORDER BY view_count DESC, created_at DESC
          LIMIT ${limit}
        `;
        return { status: 200 as const, rows: clipsResult.rows };
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
      clips: result.rows.map((clip, index) => ({
        ...clip,
        rank: index + 1,
      })),
    });
  } catch (error) {
    if (error instanceof ReplicaUnavailableError) {
      return replicaUnavailableResponse();
    }
    console.error("[routes-f/analytics-top-clips] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
