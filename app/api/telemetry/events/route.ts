/**
 * POST /api/telemetry/events
 * High-volume telemetry event ingestion endpoint
 * Receives batched playback telemetry events from clients
 */

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/tracing/logger";

export const config = {
  maxDuration: 60,
};

interface TelemetryBatch {
  viewerId: string;
  sessionId: string;
  streamId: string;
  events: Array<{
    id: string;
    timestamp: number;
    streamId: string;
    viewerId: string;
    sessionId: string;
    eventType: string;
    data: Record<string, any>;
  }>;
  sentAt: number;
}

export async function POST(request: NextRequest) {
  try {
    const batch: TelemetryBatch = await request.json();

    if (!batch.events || batch.events.length === 0) {
      return NextResponse.json(
        { error: "No events provided" },
        { status: 400 }
      );
    }

    // Validate batch structure
    if (!batch.viewerId || !batch.sessionId || !batch.streamId) {
      return NextResponse.json(
        { error: "Missing required batch fields" },
        { status: 400 }
      );
    }

    // Insert raw events into telemetry table
    const receivedAt = new Date();
    let insertedCount = 0;

    for (const event of batch.events) {
      try {
        await sql`
          INSERT INTO playback_telemetry_events (
            event_id,
            stream_id,
            viewer_id,
            session_id,
            event_type,
            data,
            recorded_at,
            received_at
          ) VALUES (
            ${event.id},
            ${event.streamId},
            ${event.viewerId},
            ${event.sessionId},
            ${event.eventType},
            ${JSON.stringify(event.data)},
            ${new Date(event.timestamp)},
            ${receivedAt}
          )
          ON CONFLICT (event_id) DO NOTHING
        `;
        insertedCount++;
      } catch (error) {
        // Log but continue with next event
        logger.warn("[telemetry] Failed to insert individual event", {
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Process session metrics if this batch contains session_end event
    const sessionEndEvent = batch.events.find((e) => e.eventType === "session_end");
    if (sessionEndEvent) {
      await processSessionMetrics(batch);
    }

    logger.info("[telemetry] Batch ingested", {
      batchSize: batch.events.length,
      insertedCount,
      sessionId: batch.sessionId,
      streamId: batch.streamId,
    });

    return NextResponse.json({
      success: true,
      ingested: insertedCount,
      total: batch.events.length,
    });
  } catch (error) {
    logger.error("[telemetry] Failed to ingest batch", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to ingest telemetry" },
      { status: 500 }
    );
  }
}

/**
 * Calculate and store session-level metrics
 */
async function processSessionMetrics(batch: TelemetryBatch) {
  try {
    const events = batch.events;

    // Find key events
    const startupEvent = events.find((e) => e.eventType === "startup");
    const sessionEndEvent = events.find((e) => e.eventType === "session_end");
    const rebufferEvents = events.filter((e) => e.eventType === "rebuffer");
    const errorEvents = events.filter((e) => e.eventType === "error");

    const startupTimeMs = startupEvent?.data?.startupTimeMs || null;
    const totalRebufferCount = rebufferEvents.length;
    const totalRebufferDurationMs =
      rebufferEvents.reduce((sum, e) => sum + (e.data?.durationMs || 0), 0) || 0;

    const sessionDurationSeconds = sessionEndEvent?.data?.durationSeconds || null;

    // Calculate rebuffer ratio
    let rebufferRatio = 0;
    if (sessionDurationSeconds && sessionDurationSeconds > 0) {
      rebufferRatio = Math.min(
        totalRebufferDurationMs / (sessionDurationSeconds * 1000),
        1.0
      );
    }

    // Upsert session metrics
    await sql`
      INSERT INTO playback_session_metrics (
        stream_id,
        viewer_id,
        session_id,
        startup_time_ms,
        total_rebuffer_count,
        total_rebuffer_duration_ms,
        rebuffer_ratio,
        error_count,
        session_duration_seconds,
        started_at,
        ended_at
      ) VALUES (
        ${batch.streamId},
        ${batch.viewerId},
        ${batch.sessionId},
        ${startupTimeMs},
        ${totalRebufferCount},
        ${totalRebufferDurationMs},
        ${rebufferRatio},
        ${errorEvents.length},
        ${sessionDurationSeconds},
        ${new Date(events[0]?.timestamp || Date.now())},
        ${new Date(sessionEndEvent?.timestamp || Date.now())}
      )
      ON CONFLICT (session_id) DO UPDATE SET
        startup_time_ms = EXCLUDED.startup_time_ms,
        total_rebuffer_count = EXCLUDED.total_rebuffer_count,
        total_rebuffer_duration_ms = EXCLUDED.total_rebuffer_duration_ms,
        rebuffer_ratio = EXCLUDED.rebuffer_ratio,
        error_count = EXCLUDED.error_count,
        session_duration_seconds = EXCLUDED.session_duration_seconds,
        ended_at = EXCLUDED.ended_at,
        updated_at = CURRENT_TIMESTAMP
    `;

    logger.debug("[telemetry] Session metrics processed", {
      sessionId: batch.sessionId,
      startupTimeMs,
      rebufferCount: totalRebufferCount,
      rebufferRatio,
    });
  } catch (error) {
    logger.warn("[telemetry] Failed to process session metrics", {
      sessionId: batch.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail the whole request if metrics processing fails
  }
}
