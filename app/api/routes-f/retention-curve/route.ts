/**
 * GET /api/routes-f/retention-curve?session_id=<uuid>&creator_id=<uuid>
 *
 * Returns viewer retention curve for a specific stream session.
 * Shows how many viewers were still watching at each point in the stream,
 * calculated from stream_viewers join/leave events bucketed at 5-minute intervals.
 *
 * Query params:
 *   session_id — required (UUID of stream_session)
 *   creator_id — required (UUID of creator/stream owner)
 *   bucket_seconds — optional (defaults to 300 = 5 minutes)
 *
 * Response 200:
 * {
 *   session_id: string,
 *   total_unique_viewers: number,
 *   peak_viewers: number,
 *   avg_viewers: number,
 *   retention_points: [
 *     {
 *       bucket_seconds: number (time from session start),
 *       viewers_present: number (concurrent viewers at this point),
 *       cumulative_viewers: number (unique viewers up to this point),
 *       retention_percentage: number (% of peak still watching)
 *     }
 *   ],
 *   engagement_summary: {
 *     drop_off_point_seconds: number (when most viewers left),
 *     drop_off_percentage: number (% who left at worst point),
 *     sustained_percentage: number (% who watched to end)
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  session_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  bucket_seconds: z.coerce.number().int().min(60).max(3600).default(300),
});

export interface RetentionPoint {
  bucket_seconds: number;
  viewers_present: number;
  cumulative_viewers: number;
  retention_percentage: number;
}

export interface RetentionCurveResponse {
  session_id: string;
  total_unique_viewers: number;
  peak_viewers: number;
  avg_viewers: number;
  retention_points: RetentionPoint[];
  engagement_summary: {
    drop_off_point_seconds: number;
    drop_off_percentage: number;
    sustained_percentage: number;
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { session_id, creator_id, bucket_seconds } = queryResult.data;

  // Verify creator ownership
  if (creator_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Verify session belongs to creator
    const { rows: sessionRows } = await sql<{
      id: string;
      user_id: string;
      started_at: string;
      ended_at: string | null;
      duration_seconds: number | null;
      peak_viewers: number;
      total_unique_viewers: number;
    }>`
      SELECT id, user_id, started_at, ended_at, duration_seconds, peak_viewers, total_unique_viewers
      FROM stream_sessions
      WHERE id = ${session_id} AND user_id = ${creator_id}
      LIMIT 1
    `;

    if (sessionRows.length === 0) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const sessionData = sessionRows[0];
    const sessionDuration = sessionData.duration_seconds || 0;
    const peakViewers = sessionData.peak_viewers;

    // Check if we have pre-computed retention data
    const { rows: precomputedRows } = await sql<{
      bucket_seconds: number;
      viewers_remaining: number;
      cumulative_viewers: number;
    }>`
      SELECT bucket_seconds, viewers_remaining, cumulative_viewers
      FROM route_f_session_retention
      WHERE session_id = ${session_id}
      ORDER BY bucket_seconds ASC
    `;

    let retentionPoints: RetentionPoint[] = [];
    let avgViewers = 0;

    if (precomputedRows.length > 0) {
      // Use pre-computed retention data
      retentionPoints = precomputedRows.map((row) => ({
        bucket_seconds: row.bucket_seconds,
        viewers_present: row.viewers_remaining,
        cumulative_viewers: row.cumulative_viewers,
        retention_percentage:
          peakViewers > 0
            ? Math.round((row.viewers_remaining / peakViewers) * 100)
            : 0,
      }));

      const avgSum = retentionPoints.reduce(
        (sum, p) => sum + p.viewers_present,
        0
      );
      avgViewers =
        retentionPoints.length > 0
          ? Math.round(avgSum / retentionPoints.length)
          : 0;
    } else {
      // Compute from raw stream_viewers data (fallback if backfill not complete)
      const { rows: viewerRows } = await sql<{
        user_id: string;
        joined_at: string;
        left_at: string | null;
      }>`
        SELECT user_id, joined_at, left_at
        FROM stream_viewers
        WHERE stream_session_id = ${session_id}
        ORDER BY joined_at ASC
      `;

      if (viewerRows.length > 0) {
        const numBuckets = Math.ceil(sessionDuration / bucket_seconds) || 1;

        for (let b = 0; b < numBuckets; b++) {
          const bucketStart = b * bucket_seconds;
          const bucketEnd = (b + 1) * bucket_seconds;

          const viewersPresent = new Set<string>();
          const cumulativeViewers = new Set<string>();

          for (const viewer of viewerRows) {
            const joinTime = Math.max(
              0,
              Math.floor(
                (new Date(viewer.joined_at).getTime() -
                  new Date(sessionData.started_at).getTime()) /
                  1000
              )
            );
            const leaveTime = viewer.left_at
              ? Math.floor(
                  (new Date(viewer.left_at).getTime() -
                    new Date(sessionData.started_at).getTime()) /
                    1000
                )
              : sessionDuration;

            // Add to cumulative if joined before bucket ends
            if (joinTime < bucketEnd) {
              cumulativeViewers.add(String(viewer.user_id));
            }

            // Add to present if watching during this bucket
            if (joinTime <= bucketStart && leaveTime > bucketStart) {
              viewersPresent.add(String(viewer.user_id));
            }
          }

          retentionPoints.push({
            bucket_seconds: bucketStart,
            viewers_present: viewersPresent.size,
            cumulative_viewers: cumulativeViewers.size,
            retention_percentage:
              peakViewers > 0
                ? Math.round((viewersPresent.size / peakViewers) * 100)
                : 0,
          });
        }

        const avgSum = retentionPoints.reduce(
          (sum, p) => sum + p.viewers_present,
          0
        );
        avgViewers =
          retentionPoints.length > 0
            ? Math.round(avgSum / retentionPoints.length)
            : 0;
      }
    }

    // Calculate engagement summary
    let dropOffPointSeconds = 0;
    let dropOffPercentage = 0;
    let sustainedPercentage = 0;

    if (retentionPoints.length > 1) {
      // Find worst drop-off point
      let maxDrop = 0;
      for (let i = 1; i < retentionPoints.length; i++) {
        const drop =
          retentionPoints[i - 1].retention_percentage -
          retentionPoints[i].retention_percentage;
        if (drop > maxDrop) {
          maxDrop = drop;
          dropOffPointSeconds = retentionPoints[i].bucket_seconds;
          dropOffPercentage = maxDrop;
        }
      }

      // Calculate how many watched to end
      const lastPoint = retentionPoints[retentionPoints.length - 1];
      sustainedPercentage = lastPoint.retention_percentage;
    } else if (retentionPoints.length === 1) {
      sustainedPercentage = retentionPoints[0].retention_percentage;
    }

    const response: RetentionCurveResponse = {
      session_id,
      total_unique_viewers: sessionData.total_unique_viewers,
      peak_viewers: peakViewers,
      avg_viewers: avgViewers,
      retention_points: retentionPoints,
      engagement_summary: {
        drop_off_point_seconds: dropOffPointSeconds,
        drop_off_percentage: dropOffPercentage,
        sustained_percentage: sustainedPercentage,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[retention-curve] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
