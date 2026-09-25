import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import { sendOperationalAlert } from "@/lib/security/alerts";
import { withTransaction } from "@/lib/postgres-transaction";
import {
  closeOpenSessions,
  openSessionIfMissing,
  type LiveUserRow,
} from "@/lib/mux/live-state";
import type {
  ActiveMuxLiveStreams,
  MuxLiveStreamStatus,
} from "@/lib/mux/server";

/**
 * Mux ↔ DB live-state reconciliation (#1399).
 *
 * Mux is the source of truth for whether a stream is broadcasting. Webhooks
 * keep users.is_live in sync in real time; this job repairs whatever they
 * missed, in both directions:
 *
 *   DB live,  Mux not active → mark offline, close dangling stream_sessions
 *   DB idle,  Mux active     → mark live, open a stream session
 *
 * Safety properties (see docs/mux-live-state-reconciliation.md):
 *   - Fail closed: any Mux error, malformed response or truncated listing
 *     aborts the run before a single write.
 *   - "DB live, Mux not active" candidates are re-confirmed one by one with a
 *     direct Mux lookup before being ended (bounded per run), so a stream
 *     that shifted between list pages is never ended by mistake.
 *   - Race protection: every correction is a conditional UPDATE that only
 *     applies if the row still has the state we observed AND its live state
 *     last changed before (run start − grace window). A webhook that lands
 *     while the job runs always wins; the grace window additionally covers
 *     Mux's own list/API propagation delay.
 *   - Each correction is its own transaction, reusing the webhook's
 *     transition helpers, so reconciliation and webhooks do identical
 *     session bookkeeping and cannot double-open or double-close sessions.
 */

export const MUX_RECONCILE_JOB = "mux_live_reconciliation";

export interface MuxLiveStateSource {
  listActive(): Promise<ActiveMuxLiveStreams>;
  getStatus(streamId: string): Promise<MuxLiveStreamStatus>;
}

export interface ReconciliationConfig {
  graceSeconds: number;
  maxConfirmationsPerRun: number;
  driftAlertThreshold: number;
  persistentDriftRuns: number;
}

function intFromEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

export function reconciliationConfigFromEnv(): ReconciliationConfig {
  return {
    graceSeconds: intFromEnv("MUX_RECONCILE_GRACE_SECONDS", 180, 30, 3600),
    maxConfirmationsPerRun: intFromEnv(
      "MUX_RECONCILE_MAX_CONFIRMATIONS",
      25,
      1,
      200
    ),
    driftAlertThreshold: intFromEnv(
      "MUX_RECONCILE_DRIFT_ALERT_THRESHOLD",
      5,
      1,
      10_000
    ),
    persistentDriftRuns: intFromEnv(
      "MUX_RECONCILE_PERSISTENT_DRIFT_RUNS",
      3,
      2,
      1000
    ),
  };
}

export class IncompleteMuxListingError extends Error {}

export interface ReconciliationSummary {
  observed_at: string;
  mux_active_streams: number;
  db_live_users: number;
  marked_offline: number;
  marked_live: number;
  sessions_closed: number;
  sessions_opened: number;
  skipped_recent_change: number;
  skipped_still_active: number;
  skipped_banned: number;
  confirmation_failures: number;
  deferred: number;
  [key: string]: unknown;
}

type Correction = "marked_offline" | "marked_live";

function logCorrection(fields: {
  correction: Correction;
  userId: string;
  muxStreamId: string | null;
  reason: string;
  observedMuxState: string;
  observedAt: string;
  liveStateChangedAt: string | null;
  sessionsClosed?: number;
  sessionOpened?: boolean;
}) {
  logger.warn("mux_reconciliation_correction", {
    source: "reconciliation",
    correction: fields.correction,
    user_id: fields.userId,
    mux_stream_id: fields.muxStreamId,
    previous_db_state:
      fields.correction === "marked_offline" ? "live" : "offline",
    observed_mux_state: fields.observedMuxState,
    reason: fields.reason,
    observed_at: fields.observedAt,
    live_state_changed_at: fields.liveStateChangedAt,
    sessions_closed: fields.sessionsClosed,
    session_opened: fields.sessionOpened,
  });
}

interface DbLiveRow {
  id: string;
  mux_stream_id: string | null;
  live_state_changed_at: string | null;
}

async function markOffline(
  row: DbLiveRow,
  observedAt: string,
  graceSeconds: number
): Promise<{ applied: boolean; sessionsClosed: number }> {
  return withTransaction(async tx => {
    const { rows } = await tx.sql`
      UPDATE users SET
        is_live = false,
        stream_started_at = NULL,
        current_viewers = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${row.id}
        AND is_live = true
        AND mux_stream_id IS NOT DISTINCT FROM ${row.mux_stream_id}
        AND (live_state_changed_at IS NULL
             OR live_state_changed_at < ${observedAt}::timestamptz
                                         - make_interval(secs => ${graceSeconds}))
      RETURNING id
    `;
    if (rows.length === 0) {
      return { applied: false, sessionsClosed: 0 };
    }
    return {
      applied: true,
      sessionsClosed: await closeOpenSessions(tx, row.id),
    };
  });
}

async function markLive(
  row: DbLiveRow,
  observedAt: string,
  graceSeconds: number
): Promise<{ applied: boolean; sessionOpened: boolean }> {
  return withTransaction(async tx => {
    const { rows } = await tx.sql<LiveUserRow>`
      UPDATE users SET
        is_live = true,
        stream_started_at = CURRENT_TIMESTAMP,
        current_viewers = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${row.id}
        AND COALESCE(is_live, false) = false
        AND COALESCE(is_banned, false) = false
        AND mux_stream_id = ${row.mux_stream_id}
        AND (live_state_changed_at IS NULL
             OR live_state_changed_at < ${observedAt}::timestamptz
                                         - make_interval(secs => ${graceSeconds}))
      RETURNING id, mux_stream_id, mux_playback_id, creator
    `;
    if (rows.length === 0) {
      return { applied: false, sessionOpened: false };
    }
    return {
      applied: true,
      sessionOpened: await openSessionIfMissing(tx, rows[0]),
    };
  });
}

/**
 * One reconciliation pass. Throws (without having written anything) if Mux
 * cannot be read completely.
 */
export async function reconcileMuxLiveState(
  source: MuxLiveStateSource,
  config: ReconciliationConfig = reconciliationConfigFromEnv()
): Promise<ReconciliationSummary> {
  // DB clock, captured BEFORE asking Mux: anything that changes a row's live
  // state after this instant is newer than our observation.
  const { rows: clock } = await sql<{ now: string }>`SELECT NOW()::text AS now`;
  const observedAt = clock[0].now;

  const listing = await source.listActive();
  if (!listing.complete) {
    throw new IncompleteMuxListingError(
      `Mux active-stream listing truncated after ${listing.pages} pages`
    );
  }
  const activeIds = [...listing.ids];

  const { rows: dbLive } = await sql<DbLiveRow>`
    SELECT id, mux_stream_id, live_state_changed_at::text AS live_state_changed_at
    FROM users
    WHERE is_live = true
  `;
  const { rows: missedLive } =
    activeIds.length === 0
      ? { rows: [] as Array<DbLiveRow & { is_banned: boolean | null }> }
      : await sql<DbLiveRow & { is_banned: boolean | null }>`
          SELECT id, mux_stream_id, is_banned,
                 live_state_changed_at::text AS live_state_changed_at
          FROM users
          WHERE mux_stream_id IN (
            SELECT jsonb_array_elements_text(${JSON.stringify(activeIds)}::jsonb)
          )
            AND COALESCE(is_live, false) = false
        `;

  const summary: ReconciliationSummary = {
    observed_at: observedAt,
    mux_active_streams: activeIds.length,
    db_live_users: dbLive.length,
    marked_offline: 0,
    marked_live: 0,
    sessions_closed: 0,
    sessions_opened: 0,
    skipped_recent_change: 0,
    skipped_still_active: 0,
    skipped_banned: 0,
    confirmation_failures: 0,
    deferred: 0,
  };

  // ── DB live, Mux not active ────────────────────────────────────────────
  const staleLive = dbLive.filter(
    r => !r.mux_stream_id || !listing.ids.has(r.mux_stream_id)
  );
  let confirmations = 0;
  for (const row of staleLive) {
    let observedMuxState = "no_mux_stream";
    if (row.mux_stream_id) {
      if (confirmations >= config.maxConfirmationsPerRun) {
        summary.deferred++;
        continue;
      }
      confirmations++;
      try {
        observedMuxState = await source.getStatus(row.mux_stream_id);
      } catch (err) {
        summary.confirmation_failures++;
        logger.warn("mux_reconciliation_confirmation_failed", {
          source: "reconciliation",
          user_id: row.id,
          mux_stream_id: row.mux_stream_id,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      if (observedMuxState === "active") {
        summary.skipped_still_active++;
        continue;
      }
    }

    const result = await markOffline(row, observedAt, config.graceSeconds);
    if (!result.applied) {
      summary.skipped_recent_change++;
      continue;
    }
    summary.marked_offline++;
    summary.sessions_closed += result.sessionsClosed;
    logCorrection({
      correction: "marked_offline",
      userId: row.id,
      muxStreamId: row.mux_stream_id,
      reason: row.mux_stream_id
        ? "db_live_but_mux_not_active"
        : "db_live_without_mux_stream",
      observedMuxState,
      observedAt,
      liveStateChangedAt: row.live_state_changed_at,
      sessionsClosed: result.sessionsClosed,
    });
  }

  // ── DB not live, Mux active ────────────────────────────────────────────
  for (const row of missedLive) {
    if (row.is_banned) {
      summary.skipped_banned++;
      continue;
    }
    const result = await markLive(row, observedAt, config.graceSeconds);
    if (!result.applied) {
      summary.skipped_recent_change++;
      continue;
    }
    summary.marked_live++;
    if (result.sessionOpened) {
      summary.sessions_opened++;
    }
    logCorrection({
      correction: "marked_live",
      userId: row.id,
      muxStreamId: row.mux_stream_id,
      reason: "mux_active_but_db_not_live",
      observedMuxState: "active",
      observedAt,
      liveStateChangedAt: row.live_state_changed_at,
      sessionOpened: result.sessionOpened,
    });
  }

  return summary;
}

export function correctionCount(summary: ReconciliationSummary): number {
  return summary.marked_offline + summary.marked_live;
}

/** Drift alerting, evaluated after the run has been recorded. */
export async function alertOnAbnormalDrift(
  summary: ReconciliationSummary,
  consecutiveDriftRuns: number,
  config: ReconciliationConfig = reconciliationConfigFromEnv()
): Promise<void> {
  const corrections = correctionCount(summary);
  const details = {
    corrections,
    marked_offline: summary.marked_offline,
    marked_live: summary.marked_live,
    deferred: summary.deferred,
    mux_active_streams: summary.mux_active_streams,
    db_live_users: summary.db_live_users,
    consecutive_drift_runs: consecutiveDriftRuns,
  };

  if (corrections + summary.deferred >= config.driftAlertThreshold) {
    await sendOperationalAlert({
      category: "mux_reconciliation",
      event: "mux_reconciliation_abnormal_drift",
      severity: "critical",
      title:
        "Mux reconciliation corrected an abnormal number of streams — webhook delivery may be degraded",
      dedupKey: "mux_reconciliation:abnormal_drift",
      cooldownSeconds: 60 * 60,
      details: { ...details, threshold: config.driftAlertThreshold },
    });
  }

  if (consecutiveDriftRuns >= config.persistentDriftRuns) {
    await sendOperationalAlert({
      category: "mux_reconciliation",
      event: "mux_reconciliation_persistent_drift",
      severity: "warning",
      title: `Mux reconciliation has corrected drift on ${consecutiveDriftRuns} consecutive runs`,
      dedupKey: "mux_reconciliation:persistent_drift",
      cooldownSeconds: 6 * 60 * 60,
      details,
    });
  }
}
