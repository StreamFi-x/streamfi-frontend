/**
 * GET /api/routes-f/analytics-session-detail?session_id=<uuid>&creator_id=<uuid>
 *
 * Returns detailed analytics for a specific stream session including:
 * - Session metadata and performance metrics
 * - Retention curve (viewer drop-off over time)
 * - Chat engagement bucketed by 5-minute intervals
 * - Peak/average concurrent viewers
 * - Viewer geography and device info if available
 *
 * Response includes both raw data points and pre-computed aggregates
 * for efficient dashboard rendering.
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
  session_id: z.string().uuid(),
  creator_id: z.string().uuid(),
});

export type SessionRetentionPoint = {
  bucket_seconds: number;
  viewers_remaining: number;
  cumulative_viewers: number;
  percentage_retained: number;
};

export type ChatEngagementPoint = {
  bucket_seconds: number;
  message_count: number;
  unique_chatters: number;
  messages_per_viewer: number;
};

export type SessionDetailResponse = {
  session: {
    id: string;
    title: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    /** True when ended_at was estimated by session reconciliation (#1402). */
    ended_at_estimated: boolean;
    peak_viewers: number;
    total_unique_viewers: number;
    avg_concurrent_viewers: number;
    total_messages: number;
  };
  retention_curve: SessionRetentionPoint[];
  chat_engagement: ChatEngagementPoint[];
  summary: {
    max_retention_percentage: number;
    min_retention_percentage: number;
    avg_retention_percentage: number;
    peak_chat_messages_in_bucket: number;
    avg_messages_per_viewer: number;
  };
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

  const { session_id, creator_id } = queryResult.data;

  // Verify creator ownership
  if (creator_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const detail = await readFromReplica(
      "routes-f.analytics-session-detail",
      async db => {
        // Fetch session metadata
        const { rows: sessionRows } = await db<{
          id: string;
          title: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          ended_at_estimated: boolean;
          peak_viewers: number;
          total_unique_viewers: number;
          total_messages: number;
        }>`
          SELECT id, title, started_at, ended_at, duration_seconds,
                 (end_source = 'reconciliation') IS TRUE AS ended_at_estimated,
                 peak_viewers, total_unique_viewers, total_messages
          FROM stream_sessions
          WHERE id = ${session_id} AND user_id = ${creator_id}
          LIMIT 1
        `;

        if (sessionRows.length === 0) {
          return null;
        }

        // Fetch retention curve
        const { rows: retentionRows } = await db<{
          bucket_seconds: number;
          viewers_remaining: number;
          cumulative_viewers: number;
        }>`
          SELECT bucket_seconds, viewers_remaining, cumulative_viewers
          FROM route_f_session_retention
          WHERE session_id = ${session_id}
          ORDER BY bucket_seconds ASC
        `;

        // Fetch chat engagement
        const { rows: chatRows } = await db<{
          bucket_seconds: number;
          message_count: number;
          unique_chatters: number;
          messages_per_viewer: number;
        }>`
          SELECT bucket_seconds, message_count, unique_chatters, messages_per_viewer
          FROM route_f_session_chat_engagement
          WHERE session_id = ${session_id}
          ORDER BY bucket_seconds ASC
        `;

        // Compute average concurrent viewers
        const { rows: avgViewerRows } = await db<{ avg_viewers: number }>`
          SELECT COALESCE(
            AVG(viewers_remaining)::INTEGER,
            0
          ) as avg_viewers
          FROM route_f_session_retention
          WHERE session_id = ${session_id}
        `;

        return {
          sessionData: sessionRows[0],
          retentionRows,
          chatRows,
          avgViewerRows,
        };
      },
      { request: req }
    );

    if (!detail) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const { sessionData, retentionRows, chatRows, avgViewerRows } = detail;

    // Compute retention percentages and aggregate
    const retentionCurve: SessionRetentionPoint[] = retentionRows.map((row) => ({
      bucket_seconds: row.bucket_seconds,
      viewers_remaining: row.viewers_remaining,
      cumulative_viewers: row.cumulative_viewers,
      percentage_retained:
        row.cumulative_viewers > 0
          ? Math.round((row.viewers_remaining / row.cumulative_viewers) * 100)
          : 0,
    }));

    let avgRetention = 0;
    if (retentionCurve.length > 0) {
      const sum = retentionCurve.reduce(
        (acc, point) => acc + point.percentage_retained,
        0
      );
      avgRetention = Math.round(sum / retentionCurve.length);
    }

    const maxRetention =
      retentionCurve.length > 0
        ? Math.max(...retentionCurve.map((p) => p.percentage_retained))
        : 0;

    const minRetention =
      retentionCurve.length > 0
        ? Math.min(...retentionCurve.map((p) => p.percentage_retained))
        : 0;

    const chatEngagement: ChatEngagementPoint[] = chatRows.map((row) => ({
      bucket_seconds: row.bucket_seconds,
      message_count: row.message_count,
      unique_chatters: row.unique_chatters,
      messages_per_viewer: Number(row.messages_per_viewer || 0),
    }));

    const peakMessages =
      chatEngagement.length > 0
        ? Math.max(...chatEngagement.map((p) => p.message_count))
        : 0;

    const avgMessagesPerViewer =
      chatEngagement.length > 0
        ? (
            chatEngagement.reduce(
              (sum, p) => sum + p.messages_per_viewer,
              0
            ) / chatEngagement.length
          ).toFixed(2)
        : "0.00";

    const avgConcurrentViewers = avgViewerRows[0]?.avg_viewers || 0;

    const response: SessionDetailResponse = {
      session: {
        id: sessionData.id,
        title: sessionData.title || "Untitled Stream",
        started_at: sessionData.started_at,
        ended_at: sessionData.ended_at,
        duration_seconds: sessionData.duration_seconds,
        ended_at_estimated: sessionData.ended_at_estimated,
        peak_viewers: sessionData.peak_viewers,
        total_unique_viewers: sessionData.total_unique_viewers,
        avg_concurrent_viewers: avgConcurrentViewers,
        total_messages: sessionData.total_messages,
      },
      retention_curve: retentionCurve,
      chat_engagement: chatEngagement,
      summary: {
        max_retention_percentage: maxRetention,
        min_retention_percentage: minRetention,
        avg_retention_percentage: avgRetention,
        peak_chat_messages_in_bucket: peakMessages,
        avg_messages_per_viewer: Number(avgMessagesPerViewer),
      },
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
    console.error("[analytics-session-detail] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
