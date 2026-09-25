/**
 * #1402: reconciles stream_sessions rows left open (ended_at IS NULL) after a
 * missed Mux `video.live_stream.idle` webhook.
 *
 * A session is an orphan only when Mux itself says its live stream is not
 * active (idle, disabled or deleted). Elapsed time never closes a session on
 * its own, and a Mux error leaves the session untouched. See
 * docs/reliability-jobs.md for the full rules.
 */
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";
import { mapWithConcurrency } from "@/lib/jobs/concurrency";
import type { JobOutcome } from "@/lib/jobs/scheduled-job";
import type { MuxLiveState } from "@/lib/mux/server";
import { logger } from "@/lib/tracing/logger";

export type StreamStateLookup = (streamId: string) => Promise<MuxLiveState>;

export interface SessionReconciliationOptions {
  getStreamState: StreamStateLookup;
  executor?: SqlExecutor;
  /** Sessions younger than this are left alone (Mux reconnect window is 60s). */
  minSessionAgeMinutes?: number;
  batchSize?: number;
  muxConcurrency?: number;
  /** Stop calling Mux after this many rate-limit responses in one run. */
  maxRateLimitResponses?: number;
  /** Correction-rate alert: at least this many closes... */
  alertMinClosed?: number;
  /** ...making up at least this share of inspected sessions. */
  alertCloseRatio?: number;
  now?: () => Date;
}

export interface SessionReconciliationMetrics {
  [key: string]: number;
  inspected: number;
  active_skipped: number;
  orphans_found: number;
  closed: number;
  duplicates_closed: number;
  race_skipped: number;
  unverifiable_skipped: number;
  mux_calls: number;
  mux_unavailable: number;
  mux_rate_limited: number;
  users_marked_offline: number;
  db_errors: number;
}

export interface SessionDecision {
  sessionId: string;
  userId: string;
  action:
    | "closed"
    | "duplicate_closed"
    | "kept_active"
    | "race_skipped"
    | "unverifiable"
    | "mux_unavailable"
    | "error";
  muxState?: MuxLiveState["state"];
  endedAt?: string;
  error?: string;
}

interface OpenSessionRow {
  id: string;
  user_id: string;
  mux_session_id: string | null;
  started_at: string | Date;
  user_mux_stream_id: string | null;
  is_live: boolean | null;
}

const MUX_MAX_CONTINUOUS_HOURS = 12;

function streamIdFor(row: OpenSessionRow): string | null {
  return row.mux_session_id || row.user_mux_stream_id || null;
}

/**
 * Closes one orphan with an estimated end time.
 *
 * ended_at = the session's last observed activity (latest chat message or
 * viewer join/leave), never before started_at, never after the moment Mux was
 * observed idle, and never past Mux's 12h max continuous duration. The row is
 * only updated if it is still open and the user has not gone live again after
 * Mux was observed, so a stale snapshot cannot close a stream that restarted.
 */
async function closeOrphan(
  executor: SqlExecutor,
  sessionId: string,
  observedAt: Date
): Promise<string | null> {
  const { rows } = await executor(
    `WITH activity AS (
       SELECT GREATEST(
         (SELECT MAX(cm.created_at) FROM chat_messages cm
            WHERE cm.stream_session_id = $1),
         (SELECT MAX(GREATEST(sv.joined_at, COALESCE(sv.left_at, sv.joined_at)))
            FROM stream_viewers sv WHERE sv.stream_session_id = $1)
       ) AS last_activity
     )
     UPDATE stream_sessions ss
        SET ended_at = LEAST(
              GREATEST(ss.started_at, COALESCE(activity.last_activity, ss.started_at)),
              $2::timestamptz,
              ss.started_at + make_interval(hours => ${MUX_MAX_CONTINUOUS_HOURS})
            ),
            end_source = 'reconciliation'
       FROM activity
      WHERE ss.id = $1
        AND ss.ended_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM users u
           WHERE u.id = ss.user_id
             AND u.is_live = TRUE
             AND u.stream_started_at > $2::timestamptz
        )
     RETURNING ss.ended_at`,
    [sessionId, observedAt.toISOString()]
  );
  if (!rows[0]) {
    return null;
  }
  const endedAt = new Date(rows[0].ended_at).toISOString();
  await executor(
    `UPDATE stream_viewers SET left_at = $2
      WHERE stream_session_id = $1 AND left_at IS NULL`,
    [sessionId, endedAt]
  );
  return endedAt;
}

/**
 * Closes an older duplicate open session when the user's stream is live and a
 * newer open session exists. It ends where the newer session began.
 */
async function closeSuperseded(
  executor: SqlExecutor,
  sessionId: string
): Promise<string | null> {
  const { rows } = await executor(
    `UPDATE stream_sessions ss
        SET ended_at = GREATEST(ss.started_at, newer.started_at),
            end_source = 'reconciliation'
       FROM (
         SELECT o.user_id, MIN(n.started_at) AS started_at
           FROM stream_sessions o
           JOIN stream_sessions n
             ON n.user_id = o.user_id
            AND n.ended_at IS NULL
            AND n.started_at > o.started_at
          WHERE o.id = $1
          GROUP BY o.user_id
       ) newer
      WHERE ss.id = $1 AND ss.ended_at IS NULL
     RETURNING ss.ended_at`,
    [sessionId]
  );
  if (!rows[0]) {
    return null;
  }
  const endedAt = new Date(rows[0].ended_at).toISOString();
  await executor(
    `UPDATE stream_viewers SET left_at = $2
      WHERE stream_session_id = $1 AND left_at IS NULL`,
    [sessionId, endedAt]
  );
  return endedAt;
}

/**
 * Clears a stale is_live flag once the user has no open session left and Mux
 * reported their current stream as not live. Skipped if they went live again
 * after the observation.
 */
async function markOfflineIfStale(
  executor: SqlExecutor,
  userId: string,
  observedAt: Date
): Promise<boolean> {
  const { rows } = await executor(
    `UPDATE users
        SET is_live = FALSE, stream_started_at = NULL, current_viewers = 0,
            updated_at = NOW()
      WHERE id = $1
        AND is_live = TRUE
        AND (stream_started_at IS NULL OR stream_started_at <= $2::timestamptz)
        AND NOT EXISTS (
          SELECT 1 FROM stream_sessions WHERE user_id = $1 AND ended_at IS NULL
        )
     RETURNING id`,
    [userId, observedAt.toISOString()]
  );
  return rows.length > 0;
}

export async function reconcileOrphanedSessions(
  options: SessionReconciliationOptions
): Promise<JobOutcome<SessionDecision[]>> {
  const executor = options.executor ?? defaultExecutor;
  const now = options.now ?? (() => new Date());
  const minAge = options.minSessionAgeMinutes ?? 10;
  const batchSize = options.batchSize ?? 200;
  const concurrency = options.muxConcurrency ?? 3;
  const maxRateLimited = options.maxRateLimitResponses ?? 3;

  const metrics: SessionReconciliationMetrics = {
    inspected: 0,
    active_skipped: 0,
    orphans_found: 0,
    closed: 0,
    duplicates_closed: 0,
    race_skipped: 0,
    unverifiable_skipped: 0,
    mux_calls: 0,
    mux_unavailable: 0,
    mux_rate_limited: 0,
    users_marked_offline: 0,
    db_errors: 0,
  };
  const decisions: SessionDecision[] = [];

  const { rows } = await executor(
    `SELECT ss.id, ss.user_id, ss.mux_session_id, ss.started_at,
            u.mux_stream_id AS user_mux_stream_id, u.is_live
       FROM stream_sessions ss
       JOIN users u ON u.id = ss.user_id
      WHERE ss.ended_at IS NULL
        AND ss.started_at < NOW() - make_interval(mins => $1::int)
      ORDER BY ss.started_at ASC
      LIMIT $2`,
    [minAge, batchSize]
  );
  const sessions = rows as OpenSessionRow[];
  metrics.inspected = sessions.length;

  // One Mux lookup per distinct live stream, with the time it was observed.
  const streamIds = Array.from(
    new Set(sessions.map(streamIdFor).filter((id): id is string => !!id))
  );
  const observations = new Map<string, { state: MuxLiveState; at: Date }>();
  await mapWithConcurrency(streamIds, concurrency, async streamId => {
    if (metrics.mux_rate_limited >= maxRateLimited) {
      observations.set(streamId, {
        state: {
          state: "unknown",
          error: "skipped after repeated Mux rate limits",
        },
        at: now(),
      });
      return;
    }
    const at = now();
    metrics.mux_calls++;
    const state = await options.getStreamState(streamId);
    if (state.state === "unknown" && state.httpStatus === 429) {
      metrics.mux_rate_limited++;
    }
    observations.set(streamId, { state, at });
  });

  // Newest open session per user among those whose stream is active.
  const newestActiveByUser = new Map<string, OpenSessionRow>();
  for (const session of sessions) {
    const id = streamIdFor(session);
    if (id && observations.get(id)?.state.state === "active") {
      const current = newestActiveByUser.get(session.user_id);
      if (
        !current ||
        new Date(session.started_at) > new Date(current.started_at)
      ) {
        newestActiveByUser.set(session.user_id, session);
      }
    }
  }

  const offlineCandidates = new Map<string, Date>();

  for (const session of sessions) {
    const streamId = streamIdFor(session);
    const decision: SessionDecision = {
      sessionId: session.id,
      userId: session.user_id,
      action: "error",
    };

    try {
      if (!streamId) {
        if (session.is_live) {
          metrics.unverifiable_skipped++;
          decision.action = "unverifiable";
          decisions.push(decision);
          continue;
        }
        // No Mux stream to consult and the user is not live locally either.
        metrics.orphans_found++;
        const endedAt = await closeOrphan(executor, session.id, now());
        if (endedAt) {
          metrics.closed++;
          decision.action = "closed";
          decision.endedAt = endedAt;
        } else {
          metrics.race_skipped++;
          decision.action = "race_skipped";
        }
        decisions.push(decision);
        continue;
      }

      const observation = observations.get(streamId);
      const state = observation?.state ?? {
        state: "unknown" as const,
        error: "not observed",
      };
      decision.muxState = state.state;

      if (state.state === "unknown") {
        metrics.mux_unavailable++;
        decision.action = "mux_unavailable";
        decisions.push(decision);
        continue;
      }

      if (state.state === "active") {
        const newest = newestActiveByUser.get(session.user_id);
        if (newest && newest.id !== session.id) {
          const endedAt = await closeSuperseded(executor, session.id);
          if (endedAt) {
            metrics.duplicates_closed++;
            decision.action = "duplicate_closed";
            decision.endedAt = endedAt;
          } else {
            metrics.race_skipped++;
            decision.action = "race_skipped";
          }
        } else {
          metrics.active_skipped++;
          decision.action = "kept_active";
        }
        decisions.push(decision);
        continue;
      }

      metrics.orphans_found++;
      const endedAt = await closeOrphan(executor, session.id, observation!.at);
      if (endedAt) {
        metrics.closed++;
        decision.action = "closed";
        decision.endedAt = endedAt;
        if (
          !session.user_mux_stream_id ||
          session.user_mux_stream_id === streamId
        ) {
          offlineCandidates.set(session.user_id, observation!.at);
        }
      } else {
        metrics.race_skipped++;
        decision.action = "race_skipped";
      }
      decisions.push(decision);
    } catch (error) {
      metrics.db_errors++;
      decision.action = "error";
      decision.error = error instanceof Error ? error.message : String(error);
      decisions.push(decision);
      logger.error("Stream session reconciliation failed for session", {
        operation: "reconcileOrphanedSessions",
        sessionId: session.id,
        errorMessage: decision.error,
      });
    }
  }

  for (const [userId, observedAt] of offlineCandidates) {
    try {
      if (await markOfflineIfStale(executor, userId, observedAt)) {
        metrics.users_marked_offline++;
      }
    } catch (error) {
      metrics.db_errors++;
      logger.error("Failed to clear stale is_live flag", {
        operation: "reconcileOrphanedSessions",
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const alerts: string[] = [];
  const corrections = metrics.closed + metrics.duplicates_closed;
  const minClosed = options.alertMinClosed ?? 5;
  const ratio = options.alertCloseRatio ?? 0.5;
  if (
    corrections >= minClosed &&
    metrics.inspected > 0 &&
    corrections / metrics.inspected >= ratio
  ) {
    alerts.push(
      `abnormal correction rate: closed ${corrections} of ${metrics.inspected} open sessions; ` +
        "check that Mux webhooks are being delivered"
    );
  }
  if (metrics.mux_calls > 0 && metrics.mux_unavailable >= metrics.mux_calls) {
    alerts.push(
      `Mux state unavailable for every checked stream (${metrics.mux_unavailable}); no sessions were closed`
    );
  }

  const failures = metrics.db_errors;
  const status =
    failures === 0 && metrics.mux_unavailable === 0
      ? "succeeded"
      : failures > 0 && failures >= metrics.inspected
        ? "failed"
        : "partial";

  return { status, metrics, alerts, detail: decisions };
}
