/**
 * GET /api/routes-f/chat-engagement-curve?session_id=<uuid>&creator_id=<uuid>
 *
 * Returns chat engagement metrics for a specific stream session bucketed
 * by 5-minute intervals. Shows when chat was most/least active during the stream.
 *
 * Normalizes message counts by concurrent viewer count to account for
 * changes in stream size (raw message count is misleading without context).
 *
 * Query params:
 *   session_id — required (UUID of stream_session)
 *   creator_id — required (UUID of creator/stream owner)
 *   bucket_seconds — optional (defaults to 300 = 5 minutes)
 *
 * Response 200:
 * {
 *   session_id: string,
 *   total_messages: number,
 *   total_unique_chatters: number,
 *   engagement_points: [
 *     {
 *       bucket_seconds: number (time from session start),
 *       message_count: number (raw messages in this bucket),
 *       unique_chatters: number (users who sent messages),
 *       messages_per_viewer: number (normalized to concurrent viewers),
 *       concurrent_viewers: number (viewers at this time, for context)
 *     }
 *   ],
 *   engagement_summary: {
 *     peak_activity_seconds: number (when chat was most active),
 *     peak_messages_per_minute: number,
 *     avg_messages_per_viewer: number (overall normalized engagement),
 *     chatters_percentage: number (% of viewers who sent messages)
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

export interface EngagementPoint {
  bucket_seconds: number;
  message_count: number;
  unique_chatters: number;
  messages_per_viewer: number;
  concurrent_viewers: number;
}

export interface ChatEngagementCurveResponse {
  session_id: string;
  total_messages: number;
  total_unique_chatters: number;
  engagement_points: EngagementPoint[];
  engagement_summary: {
    peak_activity_seconds: number;
    peak_messages_per_minute: number;
    avg_messages_per_viewer: number;
    chatters_percentage: number;
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
      total_unique_viewers: number;
      total_messages: number;
    }>`
      SELECT id, user_id, started_at, ended_at, duration_seconds, total_unique_viewers, total_messages
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
    const sessionStart = new Date(sessionData.started_at).getTime();

    // Check if we have pre-computed chat engagement data
    const { rows: precomputedRows } = await sql<{
      bucket_seconds: number;
      message_count: number;
      unique_chatters: number;
      messages_per_viewer: string;
    }>`
      SELECT bucket_seconds, message_count, unique_chatters, messages_per_viewer
      FROM route_f_session_chat_engagement
      WHERE session_id = ${session_id}
      ORDER BY bucket_seconds ASC
    `;

    let engagementPoints: EngagementPoint[] = [];
    let totalUniqueChatters = 0;

    if (precomputedRows.length > 0) {
      // Use pre-computed engagement data
      // Need to join with retention data to get concurrent viewers
      const { rows: retentionRows } = await sql<{
        bucket_seconds: number;
        viewers_remaining: number;
      }>`
        SELECT bucket_seconds, viewers_remaining
        FROM route_f_session_retention
        WHERE session_id = ${session_id}
        ORDER BY bucket_seconds ASC
      `;

      const retentionMap = new Map(
        retentionRows.map((r) => [r.bucket_seconds, r.viewers_remaining])
      );

      engagementPoints = precomputedRows.map((row) => ({
        bucket_seconds: row.bucket_seconds,
        message_count: row.message_count,
        unique_chatters: row.unique_chatters,
        messages_per_viewer: Number(row.messages_per_viewer || 0),
        concurrent_viewers:
          retentionMap.get(row.bucket_seconds) ||
          retentionMap.get(Math.floor(row.bucket_seconds / bucket_seconds) * bucket_seconds) ||
          0,
      }));

      // Sum unique chatters (approximate, may have overlap)
      totalUniqueChatters = precomputedRows.reduce(
        (sum, row) => sum + row.unique_chatters,
        0
      );
    } else {
      // Compute from raw chat_messages data (fallback if backfill not complete)
      const { rows: chatRows } = await sql<{
        user_id: string;
        created_at: string;
        message_count: number;
      }>`
        SELECT user_id, created_at, COUNT(*) as message_count
        FROM chat_messages
        WHERE stream_session_id = ${session_id} AND is_deleted = false
        GROUP BY user_id, DATE_TRUNC('${bucket_seconds} seconds'::interval, created_at)
        ORDER BY created_at ASC
      `;

      if (chatRows.length > 0) {
        const numBuckets = Math.ceil(sessionDuration / bucket_seconds) || 1;
        const bucketMessages = new Map<
          number,
          { messages: number; chatters: Set<string> }
        >();

        for (const row of chatRows) {
          const messageTime = Math.floor(
            (new Date(row.created_at).getTime() - sessionStart) / 1000
          );
          const bucket =
            Math.floor(messageTime / bucket_seconds) * bucket_seconds;

          if (!bucketMessages.has(bucket)) {
            bucketMessages.set(bucket, { messages: 0, chatters: new Set() });
          }

          const bucketData = bucketMessages.get(bucket)!;
          bucketData.messages += row.message_count;
          bucketData.chatters.add(String(row.user_id));
        }

        // Get retention data for concurrent viewer context
        const { rows: retentionRows } = await sql<{
          bucket_seconds: number;
          viewers_remaining: number;
        }>`
          SELECT bucket_seconds, viewers_remaining
          FROM route_f_session_retention
          WHERE session_id = ${session_id}
          ORDER BY bucket_seconds ASC
        `;

        const retentionMap = new Map(
          retentionRows.map((r) => [r.bucket_seconds, r.viewers_remaining])
        );

        // Build engagement points
        for (let b = 0; b < numBuckets; b++) {
          const bucketStart = b * bucket_seconds;
          const bucketData = bucketMessages.get(bucketStart);
          const concurrentViewers =
            retentionMap.get(bucketStart) || 0;

          if (bucketData) {
            engagementPoints.push({
              bucket_seconds: bucketStart,
              message_count: bucketData.messages,
              unique_chatters: bucketData.chatters.size,
              messages_per_viewer:
                concurrentViewers > 0
                  ? parseFloat((bucketData.messages / concurrentViewers).toFixed(4))
                  : 0,
              concurrent_viewers: concurrentViewers,
            });

            totalUniqueChatters += bucketData.chatters.size;
          }
        }
      }
    }

    // Calculate engagement summary
    let peakActivitySeconds = 0;
    let peakMessagesPerMinute = 0;

    if (engagementPoints.length > 0) {
      let maxActivity = 0;
      for (const point of engagementPoints) {
        const messagesPerMinute = (point.message_count / bucket_seconds) * 60;
        if (messagesPerMinute > maxActivity) {
          maxActivity = messagesPerMinute;
          peakActivitySeconds = point.bucket_seconds;
          peakMessagesPerMinute = Math.round(messagesPerMinute * 100) / 100;
        }
      }
    }

    const avgMessagesPerViewer =
      engagementPoints.length > 0
        ? (
            engagementPoints.reduce(
              (sum, p) => sum + p.messages_per_viewer,
              0
            ) / engagementPoints.length
          ).toFixed(4)
        : "0.0000";

    const chattersPercentage =
      sessionData.total_unique_viewers > 0
        ? Math.round(
            (totalUniqueChatters / sessionData.total_unique_viewers) * 100
          )
        : 0;

    const response: ChatEngagementCurveResponse = {
      session_id,
      total_messages: sessionData.total_messages,
      total_unique_chatters: totalUniqueChatters,
      engagement_points: engagementPoints,
      engagement_summary: {
        peak_activity_seconds: peakActivitySeconds,
        peak_messages_per_minute: peakMessagesPerMinute,
        avg_messages_per_viewer: Number(avgMessagesPerViewer),
        chatters_percentage: chattersPercentage,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[chat-engagement-curve] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
