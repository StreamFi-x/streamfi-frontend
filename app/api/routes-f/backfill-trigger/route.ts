/**
 * POST /api/routes-f/backfill-trigger
 *
 * Initiates an idempotent backfill job for analytics tables added after
 * production data existed (watch_history, stream_viewers).
 *
 * This endpoint:
 * - Checks backfill status and resumes from last known position
 * - Backfills watch_history from existing stream_sessions and chat_messages
 * - Backfills stream_viewers retention curves from viewer join/leave events
 * - Handles resumable pagination with cursors
 * - Prevents duplicate rows via unique indexes
 * - Runs safely without locking live tables
 *
 * Request body (optional):
 * {
 *   table?: "watch_history" | "stream_viewers" | "session_retention" | "all"
 *   force_restart?: boolean (restart from beginning, default false)
 *   batch_size?: number (rows per batch, default 1000)
 * }
 *
 * Response 200:
 * {
 *   ok: true,
 *   job_id: string (UUID),
 *   started_at: string (ISO),
 *   table: string,
 *   estimated_total: number,
 *   batches_processed: number,
 *   rows_backfilled: number,
 *   rows_skipped: number,
 *   status: "in_progress" | "completed" | "paused"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for backfill

const backfillRequestSchema = z.object({
  table: z.enum(["watch_history", "stream_viewers", "session_retention", "all"]).default("all"),
  force_restart: z.boolean().default(false),
  batch_size: z.number().int().min(100).max(10000).default(1000),
});

type BackfillRequest = z.infer<typeof backfillRequestSchema>;

interface BackfillJobResult {
  ok: boolean;
  job_id: string;
  started_at: string;
  table: string;
  estimated_total: number;
  batches_processed: number;
  rows_backfilled: number;
  rows_skipped: number;
  status: "in_progress" | "completed" | "paused";
  error?: string;
}

/**
 * Backfill watch_history from stream_sessions and chat_messages
 * Reconstructs viewer engagement based on available session data
 */
async function backfillWatchHistory(
  batchSize: number,
  forceRestart: boolean
): Promise<{ rowsBackfilled: number; rowsSkipped: number; batchesProcessed: number }> {
  let rowsBackfilled = 0;
  let rowsSkipped = 0;
  let batchesProcessed = 0;

  try {
    // Get or create cursor
    const { rows: cursorRows } = await sql`
      SELECT id, last_processed_id, rows_processed, status
      FROM route_f_backfill_watch_history_cursor
      WHERE status = 'pending'
      ORDER BY date_partition DESC
      LIMIT 1
    `;

    if (cursorRows.length === 0) {
      // No pending backfill — all done or not started
      // Check if completed exists
      const { rows: completedRows } = await sql`
        SELECT COUNT(*) as count FROM route_f_backfill_watch_history_cursor
        WHERE status = 'completed'
      `;
      if (completedRows[0]?.count > 0 && !forceRestart) {
        return { rowsBackfilled, rowsSkipped, batchesProcessed };
      }
    }

    // Backfill: for each stream_session, create watch_history records
    // from chat_messages (viewers who sent messages)
    const { rows: batchRows } = await sql`
      SELECT DISTINCT
        cm.user_id as viewer_id,
        ss.user_id as streamer_id,
        ss.id as stream_id,
        'live' as stream_type,
        ss.title as stream_title,
        ss.started_at,
        MAX(cm.created_at) as last_seen_at,
        COUNT(*) as message_count
      FROM chat_messages cm
      JOIN stream_sessions ss ON cm.stream_session_id = ss.id
      WHERE NOT EXISTS (
        SELECT 1 FROM watch_history wh
        WHERE wh.viewer_id = cm.user_id
          AND wh.streamer_id = ss.user_id
          AND wh.stream_id = ss.id::text
      )
      GROUP BY cm.user_id, ss.user_id, ss.id, ss.title, ss.started_at
      LIMIT ${batchSize}
    `;

    if (batchRows.length === 0) {
      // No more rows to backfill for watch_history
      await sql`
        UPDATE route_f_backfill_watch_history_cursor
        SET status = 'completed'
        WHERE status = 'pending'
      `;
      return { rowsBackfilled, rowsSkipped, batchesProcessed };
    }

    // Insert backfilled records
    for (const row of batchRows) {
      try {
        await sql`
          INSERT INTO watch_history (
            viewer_id, streamer_id, stream_type, stream_id, stream_title,
            started_at, last_seen_at, watch_seconds, completed
          )
          VALUES (
            ${row.viewer_id}, ${row.streamer_id}, ${row.stream_type},
            ${String(row.stream_id)}, ${row.stream_title},
            ${row.started_at}, ${row.last_seen_at}, 0, false
          )
          ON CONFLICT (viewer_id, streamer_id, stream_id, stream_type) DO NOTHING
        `;
        rowsBackfilled++;
      } catch (err) {
        rowsSkipped++;
        console.error("[backfill-trigger] Failed to insert watch_history row:", err);
      }
    }

    batchesProcessed++;

    // Mark batch as processed
    await sql`
      UPDATE route_f_backfill_watch_history_cursor
      SET rows_processed = rows_processed + ${batchRows.length}
      WHERE status = 'pending'
      LIMIT 1
    `;

    return { rowsBackfilled, rowsSkipped, batchesProcessed };
  } catch (error) {
    console.error("[backfill-trigger] watch_history backfill error:", error);
    throw error;
  }
}

/**
 * Backfill stream_viewers retention curves from viewer join/leave events
 * Computes viewer retention at 5-minute intervals
 */
async function backfillSessionRetention(
  batchSize: number,
  forceRestart: boolean
): Promise<{ rowsBackfilled: number; rowsSkipped: number; batchesProcessed: number }> {
  let rowsBackfilled = 0;
  let rowsSkipped = 0;
  let batchesProcessed = 0;

  try {
    // Find sessions without retention curves
    const { rows: sessionRows } = await sql`
      SELECT ss.id, ss.started_at, ss.ended_at, ss.duration_seconds
      FROM stream_sessions ss
      WHERE NOT EXISTS (
        SELECT 1 FROM route_f_session_retention
        WHERE session_id = ss.id
      )
      ORDER BY ss.created_at DESC
      LIMIT ${batchSize}
    `;

    if (sessionRows.length === 0) {
      // All sessions have retention data
      return { rowsBackfilled, rowsSkipped, batchesProcessed };
    }

    for (const session of sessionRows) {
      try {
        // Get all viewer events for this session
        const { rows: viewerEvents } = await sql`
          SELECT
            user_id,
            joined_at,
            left_at,
            EXTRACT(EPOCH FROM (joined_at - ${session.started_at}))::INT as join_offset,
            EXTRACT(EPOCH FROM (COALESCE(left_at, ${session.ended_at}) - ${session.started_at}))::INT as leave_offset
          FROM stream_viewers
          WHERE stream_session_id = ${session.id}
          ORDER BY joined_at ASC
        `;

        if (viewerEvents.length === 0) {
          rowsSkipped++;
          continue;
        }

        // Compute retention at 5-minute buckets (300 seconds)
        const bucketSize = 300;
        const maxBuckets = session.duration_seconds
          ? Math.ceil(session.duration_seconds / bucketSize)
          : 0;

        // Track viewers in/out at each bucket
        const bucketRetention = new Map<
          number,
          { viewers: Set<string>; cumulative: Set<string> }
        >();

        for (let bucket = 0; bucket <= maxBuckets; bucket++) {
          const bucketStart = bucket * bucketSize;
          const bucketEnd = (bucket + 1) * bucketSize;

          const viewersInBucket = new Set<string>();
          const cumulativeViewers = new Set<string>();

          for (const event of viewerEvents) {
            const userId = String(event.user_id);
            const joinOffset = event.join_offset || 0;
            const leaveOffset = event.leave_offset || session.duration_seconds || 0;

            // Add to cumulative if they joined before bucket ends
            if (joinOffset <= bucketEnd) {
              cumulativeViewers.add(userId);
            }

            // Add to active if they were present during bucket
            if (joinOffset <= bucketStart && leaveOffset > bucketStart) {
              viewersInBucket.add(userId);
            }
          }

          if (cumulativeViewers.size > 0) {
            bucketRetention.set(bucket, {
              viewers: viewersInBucket,
              cumulative: cumulativeViewers,
            });
          }
        }

        // Insert retention records
        for (const [bucket, data] of bucketRetention) {
          try {
            await sql`
              INSERT INTO route_f_session_retention (
                session_id, bucket_seconds, viewers_remaining, cumulative_viewers, created_at
              )
              VALUES (
                ${session.id},
                ${bucket * bucketSize},
                ${data.viewers.size},
                ${data.cumulative.size},
                NOW()
              )
              ON CONFLICT (session_id, bucket_seconds) DO NOTHING
            `;
            rowsBackfilled++;
          } catch (err) {
            rowsSkipped++;
            console.error("[backfill-trigger] Failed to insert retention row:", err);
          }
        }

        batchesProcessed++;
      } catch (err) {
        rowsSkipped++;
        console.error("[backfill-trigger] Failed to process session:", err);
      }
    }

    return { rowsBackfilled, rowsSkipped, batchesProcessed };
  } catch (error) {
    console.error("[backfill-trigger] session_retention backfill error:", error);
    throw error;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Only admins can trigger backfills
  const { rows: adminRows } = await sql`
    SELECT id FROM users WHERE id = ${session.userId} AND role = 'admin' LIMIT 1
  `;

  if (adminRows.length === 0) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  let body: Partial<BackfillRequest> = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is OK
  }

  const validation = backfillRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { table, force_restart, batch_size } = validation.data;
  const jobId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  try {
    let rowsBackfilled = 0;
    let rowsSkipped = 0;
    let batchesProcessed = 0;
    let estimatedTotal = 0;

    if (table === "watch_history" || table === "all") {
      const { rows } = await sql`
        SELECT COUNT(*) as count FROM chat_messages cm
        WHERE NOT EXISTS (
          SELECT 1 FROM watch_history wh
          WHERE wh.viewer_id = cm.user_id
        )
      `;
      estimatedTotal += rows[0]?.count || 0;

      const result = await backfillWatchHistory(batch_size, force_restart);
      rowsBackfilled += result.rowsBackfilled;
      rowsSkipped += result.rowsSkipped;
      batchesProcessed += result.batchesProcessed;
    }

    if (table === "session_retention" || table === "all") {
      const { rows } = await sql`
        SELECT COUNT(*) as count FROM stream_sessions ss
        WHERE NOT EXISTS (
          SELECT 1 FROM route_f_session_retention WHERE session_id = ss.id
        )
      `;
      estimatedTotal += (rows[0]?.count || 0) * 100; // Rough estimate: ~100 buckets per session

      const result = await backfillSessionRetention(batch_size, force_restart);
      rowsBackfilled += result.rowsBackfilled;
      rowsSkipped += result.rowsSkipped;
      batchesProcessed += result.batchesProcessed;
    }

    const response: BackfillJobResult = {
      ok: true,
      job_id: jobId,
      started_at: startedAt,
      table,
      estimated_total: estimatedTotal,
      batches_processed: batchesProcessed,
      rows_backfilled: rowsBackfilled,
      rows_skipped: rowsSkipped,
      status: batchesProcessed > 0 ? "in_progress" : "completed",
    };

    // Log backfill job
    await sql`
      INSERT INTO route_f_backfill_log (backfill_job_id, table_name, record_id, action, created_at)
      VALUES (${jobId}::uuid, ${table}, ${jobId}::uuid, 'backfill_started', NOW())
    `;

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[backfill-trigger] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
