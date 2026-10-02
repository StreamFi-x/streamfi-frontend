/**
 * Backfill utility for reconstructing analytics data from raw sources.
 * Handles idempotent reconstruction of watch_history, stream_viewers retention,
 * and chat engagement data from existing tables.
 */

import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import { subDays } from "date-fns";

export type BackfillTableName =
  | "watch_history"
  | "stream_viewers"
  | "session_retention"
  | "session_chat_engagement";

export interface BackfillJob {
  id: string;
  table_name: BackfillTableName;
  last_backfill_at: Date | null;
  last_cursor: number | null;
  rows_backfilled: number;
  rows_skipped: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  error_message: string | null;
  estimated_remaining_rows: number | null;
}

export interface BackfillResult {
  jobId: string;
  tableName: BackfillTableName;
  rowsProcessed: number;
  rowsSkipped: number;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Initialize backfill tracking table if it doesn't exist
 */
export async function ensureBackfillSchema(): Promise<void> {
  try {
    await sql`
      SELECT 1 FROM route_f_backfill_status LIMIT 1
    `;
  } catch {
    throw new Error(
      "Backfill tables not initialized. Run migration: db/migrations/20260924_session_retention_analytics.sql"
    );
  }
}

/**
 * Get or create backfill job for a table
 */
export async function getOrCreateBackfillJob(
  tableName: BackfillTableName
): Promise<BackfillJob> {
  const { rows } = await sql`
    SELECT id, table_name, last_backfill_at, last_cursor, rows_backfilled,
           rows_skipped, status, error_message, estimated_remaining_rows
    FROM route_f_backfill_status
    WHERE table_name = ${tableName}
    LIMIT 1
  `;

  if (rows.length > 0) {
    return rows[0] as BackfillJob;
  }

  // Create new job
  const { rows: newRows } = await sql`
    INSERT INTO route_f_backfill_status (table_name, status)
    VALUES (${tableName}, 'pending')
    RETURNING id, table_name, last_backfill_at, last_cursor, rows_backfilled,
              rows_skipped, status, error_message, estimated_remaining_rows
  `;

  return newRows[0] as BackfillJob;
}

/**
 * Mark backfill job as in progress
 */
export async function startBackfillJob(jobId: string): Promise<void> {
  await sql`
    UPDATE route_f_backfill_status
    SET status = 'in_progress'
    WHERE id = ${jobId}
  `;
}

/**
 * Mark backfill job as completed or failed
 */
export async function completeBackfillJob(
  jobId: string,
  success: boolean,
  rowsProcessed: number,
  rowsSkipped: number,
  error?: string
): Promise<void> {
  await sql`
    UPDATE route_f_backfill_status
    SET status = ${success ? "completed" : "failed"},
        rows_backfilled = rows_backfilled + ${rowsProcessed},
        rows_skipped = rows_skipped + ${rowsSkipped},
        error_message = ${error || null},
        last_backfill_at = NOW()
    WHERE id = ${jobId}
  `;
}

/**
 * Reconstruct watch_history from stream_sessions and stream_viewers join events
 * Returns viewers who watched a particular creator's stream
 */
export async function backfillWatchHistory(
  batchSize: number = 1000
): Promise<BackfillResult> {
  const startTime = Date.now();
  const job = await getOrCreateBackfillJob("watch_history");
  let rowsProcessed = 0;
  let rowsSkipped = 0;

  try {
    await startBackfillJob(job.id);

    // Find stream_sessions older than 7 days that don't have watch_history entries
    const { rows: sessions } = await sql`
      SELECT ss.id, ss.user_id as creator_id, ss.started_at, ss.ended_at, ss.title
      FROM stream_sessions ss
      WHERE ss.created_at < NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM watch_history wh 
          WHERE wh.streamer_id = ss.user_id 
            AND wh.stream_type = 'live'
        )
      ORDER BY ss.started_at DESC
      LIMIT ${batchSize}
    `;

    logger.info(`[backfill] watch_history: Found ${sessions.length} sessions to process`);

    for (const session of sessions) {
      // Get all viewers for this session
      const { rows: viewers } = await sql`
        SELECT DISTINCT user_id, MIN(joined_at) as first_joined, MAX(left_at) as last_left
        FROM stream_viewers
        WHERE stream_session_id = ${session.id}
          AND user_id IS NOT NULL
        GROUP BY user_id
      `;

      // Insert or update watch_history entries
      for (const viewer of viewers) {
        try {
          await sql`
            INSERT INTO watch_history 
              (viewer_id, streamer_id, stream_type, stream_id, stream_title, 
               started_at, last_seen_at, watch_seconds, completed)
            VALUES 
              (${viewer.user_id}, ${session.creator_id}, 'live', 
               ${session.id}, ${session.title},
               ${session.started_at}, ${viewer.last_left || new Date()},
               ${
                 viewer.last_left
                   ? Math.floor(
                       (new Date(viewer.last_left).getTime() -
                         new Date(viewer.first_joined).getTime()) /
                         1000
                     )
                   : 0
               },
               ${viewer.last_left ? true : false})
            ON CONFLICT (viewer_id, streamer_id, stream_id, stream_type) 
            DO UPDATE SET 
              last_seen_at = EXCLUDED.last_seen_at,
              watch_seconds = EXCLUDED.watch_seconds,
              completed = EXCLUDED.completed
          `;
          rowsProcessed++;
        } catch (err) {
          // Duplicate or constraint violation - skip
          rowsSkipped++;
        }
      }
    }

    await completeBackfillJob(job.id, true, rowsProcessed, rowsSkipped);

    logger.info(
      `[backfill] watch_history completed: ${rowsProcessed} inserted, ${rowsSkipped} skipped`
    );

    return {
      jobId: job.id,
      tableName: "watch_history",
      rowsProcessed,
      rowsSkipped,
      duration: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    await completeBackfillJob(job.id, false, rowsProcessed, rowsSkipped, errorMsg);

    logger.error(`[backfill] watch_history failed: ${errorMsg}`);

    return {
      jobId: job.id,
      tableName: "watch_history",
      rowsProcessed,
      rowsSkipped,
      duration: Date.now() - startTime,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Reconstruct session retention curve from stream_viewers join/leave timestamps
 * Groups viewers into 5-minute buckets and counts remaining viewers
 */
export async function backfillSessionRetention(
  batchSize: number = 100
): Promise<BackfillResult> {
  const startTime = Date.now();
  const job = await getOrCreateBackfillJob("session_retention");
  let rowsProcessed = 0;
  let rowsSkipped = 0;

  try {
    await startBackfillJob(job.id);

    const BUCKET_INTERVAL_SECONDS = 300; // 5 minutes

    // Find sessions without retention data
    const { rows: sessions } = await sql`
      SELECT ss.id, ss.started_at, ss.ended_at, ss.duration_seconds
      FROM stream_sessions ss
      WHERE ss.duration_seconds > 0
        AND NOT EXISTS (
          SELECT 1 FROM route_f_session_retention sr
          WHERE sr.session_id = ss.id
        )
      ORDER BY ss.started_at DESC
      LIMIT ${batchSize}
    `;

    logger.info(`[backfill] session_retention: Found ${sessions.length} sessions to process`);

    for (const session of sessions) {
      const duration = session.duration_seconds || 0;
      const bucketCount = Math.ceil(duration / BUCKET_INTERVAL_SECONDS);

      // Get all viewer join/leave times for this session
      const { rows: viewerEvents } = await sql`
        SELECT user_id, joined_at, left_at
        FROM stream_viewers
        WHERE stream_session_id = ${session.id}
        ORDER BY joined_at ASC
      `;

      const sessionStart = new Date(session.started_at);

      // For each 5-minute bucket, count viewers still present
      for (let bucketIdx = 0; bucketIdx < bucketCount; bucketIdx++) {
        const bucketSeconds = bucketIdx * BUCKET_INTERVAL_SECONDS;
        const bucketEnd = new Date(sessionStart.getTime() + (bucketSeconds + BUCKET_INTERVAL_SECONDS) * 1000);

        // Count viewers present at this bucket
        const viewersRemaining = viewerEvents.filter((v: any) => {
          const joinedAt = new Date(v.joined_at);
          const leftAt = v.left_at ? new Date(v.left_at) : new Date();
          return joinedAt <= bucketEnd && leftAt >= bucketEnd;
        }).length;

        // Count cumulative unique viewers up to this bucket
        const cumulativeViewers = viewerEvents.filter((v: any) => {
          const joinedAt = new Date(v.joined_at);
          return joinedAt <= bucketEnd;
        }).length;

        try {
          await sql`
            INSERT INTO route_f_session_retention 
              (session_id, bucket_seconds, viewers_remaining, cumulative_viewers)
            VALUES 
              (${session.id}, ${bucketSeconds}, ${viewersRemaining}, ${cumulativeViewers})
            ON CONFLICT (session_id, bucket_seconds) DO NOTHING
          `;
          rowsProcessed++;
        } catch {
          rowsSkipped++;
        }
      }
    }

    await completeBackfillJob(job.id, true, rowsProcessed, rowsSkipped);

    logger.info(
      `[backfill] session_retention completed: ${rowsProcessed} inserted, ${rowsSkipped} skipped`
    );

    return {
      jobId: job.id,
      tableName: "session_retention",
      rowsProcessed,
      rowsSkipped,
      duration: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    await completeBackfillJob(job.id, false, rowsProcessed, rowsSkipped, errorMsg);

    logger.error(`[backfill] session_retention failed: ${errorMsg}`);

    return {
      jobId: job.id,
      tableName: "session_retention",
      rowsProcessed,
      rowsSkipped,
      duration: Date.now() - startTime,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Reconstruct chat engagement bucketed by 5-minute intervals
 */
export async function backfillSessionChatEngagement(
  batchSize: number = 100
): Promise<BackfillResult> {
  const startTime = Date.now();
  const job = await getOrCreateBackfillJob("session_chat_engagement");
  let rowsProcessed = 0;
  let rowsSkipped = 0;

  try {
    await startBackfillJob(job.id);

    const BUCKET_INTERVAL_SECONDS = 300; // 5 minutes

    // Find sessions without chat engagement data
    const { rows: sessions } = await sql`
      SELECT ss.id, ss.started_at, ss.duration_seconds, ss.total_messages
      FROM stream_sessions ss
      WHERE ss.total_messages > 0
        AND NOT EXISTS (
          SELECT 1 FROM route_f_session_chat_engagement sce
          WHERE sce.session_id = ss.id
        )
      ORDER BY ss.started_at DESC
      LIMIT ${batchSize}
    `;

    logger.info(
      `[backfill] session_chat_engagement: Found ${sessions.length} sessions to process`
    );

    for (const session of sessions) {
      const duration = session.duration_seconds || 0;
      const bucketCount = Math.ceil(duration / BUCKET_INTERVAL_SECONDS);

      // Get all chat messages with timestamps
      const { rows: messages } = await sql`
        SELECT user_id, created_at
        FROM chat_messages
        WHERE stream_session_id = ${session.id}
          AND is_deleted = FALSE
        ORDER BY created_at ASC
      `;

      const sessionStart = new Date(session.started_at);

      // For each 5-minute bucket, count messages and unique chatters
      for (let bucketIdx = 0; bucketIdx < bucketCount; bucketIdx++) {
        const bucketSeconds = bucketIdx * BUCKET_INTERVAL_SECONDS;
        const bucketStart = new Date(
          sessionStart.getTime() + bucketSeconds * 1000
        );
        const bucketEnd = new Date(bucketStart.getTime() + BUCKET_INTERVAL_SECONDS * 1000);

        const bucketed = messages.filter((m: any) => {
          const messageTime = new Date(m.created_at);
          return messageTime >= bucketStart && messageTime < bucketEnd;
        });

        const messageCount = bucketed.length;
        const uniqueChatters = new Set(bucketed.map((m: any) => m.user_id)).size;

        // Get concurrent viewers for this bucket
        const { rows: viewerRows } = await sql`
          SELECT COUNT(DISTINCT user_id) as viewer_count
          FROM stream_viewers
          WHERE stream_session_id = ${session.id}
            AND joined_at <= ${bucketEnd.toISOString()}
            AND (left_at IS NULL OR left_at >= ${bucketStart.toISOString()})
        `;

        const concurrentViewers = Number(viewerRows[0]?.viewer_count || 1);
        const messagesPerViewer = messageCount / Math.max(concurrentViewers, 1);

        try {
          await sql`
            INSERT INTO route_f_session_chat_engagement 
              (session_id, bucket_seconds, message_count, unique_chatters, messages_per_viewer)
            VALUES 
              (${session.id}, ${bucketSeconds}, ${messageCount}, ${uniqueChatters}, ${messagesPerViewer})
            ON CONFLICT (session_id, bucket_seconds) DO NOTHING
          `;
          rowsProcessed++;
        } catch {
          rowsSkipped++;
        }
      }
    }

    await completeBackfillJob(job.id, true, rowsProcessed, rowsSkipped);

    logger.info(
      `[backfill] session_chat_engagement completed: ${rowsProcessed} inserted, ${rowsSkipped} skipped`
    );

    return {
      jobId: job.id,
      tableName: "session_chat_engagement",
      rowsProcessed,
      rowsSkipped,
      duration: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    await completeBackfillJob(job.id, false, rowsProcessed, rowsSkipped, errorMsg);

    logger.error(`[backfill] session_chat_engagement failed: ${errorMsg}`);

    return {
      jobId: job.id,
      tableName: "session_chat_engagement",
      rowsProcessed,
      rowsSkipped,
      duration: Date.now() - startTime,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Get backfill status for all tables
 */
export async function getBackfillStatus(): Promise<BackfillJob[]> {
  const { rows } = await sql`
    SELECT id, table_name, last_backfill_at, last_cursor, rows_backfilled,
           rows_skipped, status, error_message, estimated_remaining_rows
    FROM route_f_backfill_status
    ORDER BY updated_at DESC
  `;

  return rows as BackfillJob[];
}
