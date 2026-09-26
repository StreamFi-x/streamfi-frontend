/**
 * #1403: reconciles users.current_viewers against the true set of currently
 * connected viewers in stream_viewers, and closes stream_viewers rows whose
 * viewer never called the leave endpoint (tab closed, connection lost,
 * browser crashed).
 *
 * current_viewers is an independently maintained counter, incremented on
 * join and decremented on leave (app/api/streams/viewers/route.ts). Nothing
 * previously corrected it back to ground truth while a stream stayed live;
 * the only path that reset it was the fully-offline transition in
 * lib/mux/reconciliation.ts and lib/stream/session-reconciliation.ts, which
 * does not help a still-live stream whose counter has already drifted.
 *
 * "Currently connected" is judged by heartbeat_at (see
 * db/migrations/20260926121650_add_stream_viewer_heartbeat.sql), touched
 * periodically by the watch page while a viewer is actually still on the
 * page. A row is abandoned once its heartbeat is older than
 * staleWindowSeconds; the exact multiple of the client's real ping interval
 * is a tuning parameter, not a correctness requirement, since a too-short
 * window only means an occasional false-positive "leave" that a real
 * still-watching viewer's next heartbeat immediately corrects.
 */
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";
import type { JobOutcome } from "@/lib/jobs/scheduled-job";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { logger } from "@/lib/tracing/logger";

export interface ViewerCountReconciliationOptions {
  executor?: SqlExecutor;
  /** A stream_viewers row with no heartbeat this old is abandoned. */
  staleWindowSeconds?: number;
  /** Live streams processed per run. */
  batchSize?: number;
  /** Correction-rate alert: at least this many streams corrected... */
  alertMinCorrected?: number;
  /** ...making up at least this share of inspected live streams. */
  alertCorrectionRatio?: number;
  now?: () => Date;
}

export interface ViewerCountReconciliationMetrics {
  [key: string]: number;
  live_streams_inspected: number;
  abandoned_viewers_closed: number;
  counters_corrected: number;
  counters_already_accurate: number;
  db_errors: number;
}

export interface StreamCorrection {
  userId: string;
  abandonedClosed: number;
  before: number;
  after: number;
  corrected: boolean;
}

export async function reconcileViewerCounts(
  options: ViewerCountReconciliationOptions = {}
): Promise<JobOutcome<StreamCorrection[]>> {
  const executor = options.executor ?? defaultExecutor;
  const now = options.now ?? (() => new Date());
  const staleWindowSeconds = options.staleWindowSeconds ?? 90;
  const batchSize = options.batchSize ?? 500;

  const metrics: ViewerCountReconciliationMetrics = {
    live_streams_inspected: 0,
    abandoned_viewers_closed: 0,
    counters_corrected: 0,
    counters_already_accurate: 0,
    db_errors: 0,
  };
  const corrections: StreamCorrection[] = [];
  const observedAt = now().toISOString();

  let liveUserIds: string[];
  try {
    const { rows } = await executor(
      `SELECT id FROM users WHERE is_live = true ORDER BY id LIMIT $1`,
      [batchSize]
    );
    liveUserIds = rows.map(r => r.id as string);
  } catch (error) {
    metrics.db_errors++;
    return {
      status: "failed",
      metrics,
      alerts: [
        `failed to list live streams: ${error instanceof Error ? error.message : String(error)}`,
      ],
      detail: corrections,
    };
  }
  metrics.live_streams_inspected = liveUserIds.length;

  for (const userId of liveUserIds) {
    try {
      // Close abandoned rows first: a viewer whose heartbeat went stale
      // never called the leave endpoint, so their row is still "open"
      // (left_at IS NULL) even though they are gone.
      const { rows: closedRows } = await executor(
        `UPDATE stream_viewers sv
            SET left_at = $2::timestamptz
           FROM stream_sessions ss
          WHERE sv.stream_session_id = ss.id
            AND ss.user_id = $1
            AND sv.left_at IS NULL
            AND ss.ended_at IS NULL
            AND COALESCE(sv.heartbeat_at, sv.joined_at) < $2::timestamptz
                                                            - make_interval(secs => $3::int)
          RETURNING sv.id`,
        [userId, observedAt, staleWindowSeconds]
      );
      const abandonedClosed = closedRows.length;
      metrics.abandoned_viewers_closed += abandonedClosed;

      // True count: open stream_viewers rows for this user's current (still
      // live, not-ended) session, after the sweep above.
      const { rows: countRows } = await executor(
        `SELECT COUNT(*)::int AS true_count
           FROM stream_viewers sv
           JOIN stream_sessions ss ON sv.stream_session_id = ss.id
          WHERE ss.user_id = $1
            AND ss.ended_at IS NULL
            AND sv.left_at IS NULL`,
        [userId]
      );
      const trueCount = countRows[0]?.true_count ?? 0;

      // Conditional UPDATE: only overwrite current_viewers if it is actually
      // wrong. A concurrent join/leave between the COUNT above and this
      // UPDATE either already matches (no-op) or will be corrected on the
      // next run; either way this never fights a live join/leave request.
      // The prior value is captured via a CTE scanned before the UPDATE
      // applies (not a separate round-trip beforehand, and not a
      // same-statement subquery reading the same table mid-UPDATE, whose
      // visibility of the row's old-vs-new value is not something to rely
      // on), so "before" always reflects exactly what this UPDATE
      // overwrote.
      const { rows: correctedRows } = await executor(
        `WITH old AS (
           SELECT current_viewers FROM users WHERE id = $1
         )
         UPDATE users
            SET current_viewers = $2, updated_at = CURRENT_TIMESTAMP
           FROM old
          WHERE users.id = $1 AND users.current_viewers IS DISTINCT FROM $2
         RETURNING old.current_viewers AS before_value`,
        [userId, trueCount]
      );

      if (correctedRows.length > 0) {
        metrics.counters_corrected++;
        if (abandonedClosed > 0) {
          await invalidateUserCaches({ id: userId }).catch(() => {});
        }
      } else {
        metrics.counters_already_accurate++;
      }

      corrections.push({
        userId,
        abandonedClosed,
        before:
          correctedRows.length > 0 ? correctedRows[0].before_value : trueCount,
        after: trueCount,
        corrected: correctedRows.length > 0,
      });
    } catch (error) {
      metrics.db_errors++;
      logger.error("Viewer count reconciliation failed for user", {
        operation: "reconcileViewerCounts",
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      corrections.push({
        userId,
        abandonedClosed: 0,
        before: -1,
        after: -1,
        corrected: false,
      });
    }
  }

  const alerts: string[] = [];
  const minCorrected = options.alertMinCorrected ?? 10;
  const ratio = options.alertCorrectionRatio ?? 0.3;
  if (
    metrics.counters_corrected >= minCorrected &&
    metrics.live_streams_inspected > 0 &&
    metrics.counters_corrected / metrics.live_streams_inspected >= ratio
  ) {
    alerts.push(
      `abnormal drift: corrected current_viewers on ${metrics.counters_corrected} of ` +
        `${metrics.live_streams_inspected} live streams; check that the viewer ` +
        "join/leave and heartbeat endpoints are being called correctly"
    );
  }

  const status =
    metrics.db_errors === 0
      ? "succeeded"
      : metrics.db_errors >= metrics.live_streams_inspected &&
          metrics.live_streams_inspected > 0
        ? "failed"
        : "partial";

  return { status, metrics, alerts, detail: corrections };
}
