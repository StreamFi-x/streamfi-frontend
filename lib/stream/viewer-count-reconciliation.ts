/** Reconciles each live stream through the same transaction and creator lock as
 * join/heartbeat/leave, so a sweep cannot overwrite a concurrent join with an
 * older snapshot. Also expires stale records and samples confirmed peaks.
 */
import {
  mutateViewerTracking,
  type ViewerTransaction,
} from "@/lib/stream/viewer-tracking";
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";
import type { JobOutcome } from "@/lib/jobs/scheduled-job";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { logger } from "@/lib/tracing/logger";

export interface ViewerCountReconciliationOptions {
  executor?: SqlExecutor;
  transaction?: ViewerTransaction;
  /** A stream_viewers row with no heartbeat this old is abandoned. */
  staleWindowSeconds?: number;
  /** Live streams processed per run. */
  batchSize?: number;
  /** Correction-rate alert: at least this many streams corrected... */
  alertMinCorrected?: number;
  /** ...making up at least this share of inspected live streams. */
  alertCorrectionRatio?: number;
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
      const snapshot = await mutateViewerTracking(
        { userId, action: "reconcile", staleWindowSeconds },
        options.transaction
      );
      if (!snapshot) {
        continue;
      }
      const abandonedClosed = snapshot.abandonedClosed;
      metrics.abandoned_viewers_closed += abandonedClosed;
      const trueCount = snapshot.currentViewers;
      const correctedRows =
        snapshot.previousViewers !== trueCount
          ? [{ before_value: snapshot.previousViewers }]
          : [];

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
