/**
 * Orphaned-session reaper (#1402).
 *
 * `stream_sessions` rows are closed by the Mux `video.live_stream.idle`
 * webhook and by nothing else. A single missed delivery leaves a row with
 * `ended_at IS NULL` forever, and because that column is also the
 * active-session dedup signal, the stale row keeps blocking new sessions for
 * that user. Nothing self-heals.
 *
 * This worker corrects that — carefully:
 *
 * - Mux is the source of truth (`lib/stream/session-consistency`). A row is
 *   only a candidate when its stream is *not* in Mux's active set.
 * - Elapsed time is a second signal only (staleness threshold), never the
 *   reason to close a row.
 * - Before each destructive write the stream is re-checked individually, so a
 *   broadcast that started after the list snapshot is not closed.
 * - If Mux cannot be queried nothing is closed, and that fact is alerted —
 *   a silently failing job defeats its own purpose.
 * - The backfilled `ended_at` is flagged with `ended_at_estimated = TRUE`:
 *   the real end time was never captured, so downstream duration consumers
 *   can tell an estimate from a precise value.
 * - Corrections are logged with a distinct marker so an abnormal rate is
 *   visible and separable from webhook-driven writes.
 */

import type { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession } from "@/lib/admin-auth";
import { logger } from "@/lib/tracing/logger";
import {
  ORPHAN_SESSION_LOG_MARKER,
  classifyOpenSession,
  confirmStreamStopped,
  fetchMuxGroundTruth,
  getReaperConfig,
  type OpenSessionCandidate,
} from "@/lib/stream/session-consistency";

export interface CorrectionRecord {
  session_id: string;
  username: string;
  mux_stream_id: string;
  started_at: string | null;
  estimated_end: string;
  age_minutes: number;
}

export interface ReaperResult {
  ran: boolean;
  ground_truth_reachable: boolean;
  active_streams: number;
  candidates_checked: number;
  sessions_closed: number;
  sessions_still_active: number;
  sessions_unverifiable: number;
  sessions_already_closed: number;
  sessions_with_errors: number;
  alert: boolean;
  alert_threshold: number;
  corrections: CorrectionRecord[];
}

/**
 * Authorizes a scheduled run: cron bearer token, internal secret, or an
 * admin session (for manual runs from the dashboard).
 */
export async function verifyCronAuthorization(
  req: NextRequest
): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization") ?? "";
  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (
    internalSecret &&
    req.headers.get("x-internal-secret") === internalSecret
  ) {
    return true;
  }

  if (!cronSecret && !internalSecret) {
    logger.warn(
      `${ORPHAN_SESSION_LOG_MARKER} neither CRON_SECRET nor INTERNAL_API_SECRET is set — falling back to admin session auth`
    );
  }

  try {
    return await verifyAdminSession();
  } catch (error) {
    logger.warn(
      `${ORPHAN_SESSION_LOG_MARKER} admin session check failed — treating request as unauthorized`,
      { errorMessage: error instanceof Error ? error.message : String(error) }
    );
    return false;
  }
}

async function sendOpsAlert(
  payload: Record<string, unknown>
): Promise<boolean> {
  const { alertWebhookUrl } = getReaperConfig();
  if (!alertWebhookUrl) {
    logger.error(
      `${ORPHAN_SESSION_LOG_MARKER} abnormal rate — no alert webhook configured`,
      payload
    );
    return false;
  }

  try {
    const response = await fetch(alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      logger.error(
        `${ORPHAN_SESSION_LOG_MARKER} alert webhook returned non-2xx`,
        {
          status: response.status,
        }
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.error(`${ORPHAN_SESSION_LOG_MARKER} alert webhook failed`, {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Runs one pass of the reaper. Returns a serialisable summary; the route
 * handlers turn it into a response.
 */
export async function runOrphanSessionReaper(): Promise<ReaperResult> {
  const config = getReaperConfig();

  const result: ReaperResult = {
    ran: false,
    ground_truth_reachable: false,
    active_streams: 0,
    candidates_checked: 0,
    sessions_closed: 0,
    sessions_still_active: 0,
    sessions_unverifiable: 0,
    sessions_already_closed: 0,
    sessions_with_errors: 0,
    alert: false,
    alert_threshold: config.alertThreshold,
    corrections: [],
  };

  const groundTruth = await fetchMuxGroundTruth();

  if (!groundTruth.reachable) {
    // Fail closed: no Mux state, no corrections. Alert, because a reaper that
    // silently stops correcting is indistinguishable from a healthy one.
    logger.error(
      `${ORPHAN_SESSION_LOG_MARKER} Mux ground truth unavailable — no sessions were modified`,
      { error: groundTruth.error }
    );
    result.alert = await sendOpsAlert({
      event: "orphan_session_reaper_degraded",
      reason: "Mux ground truth unavailable",
      detail: groundTruth.error ?? "unknown",
    });
    return result;
  }

  result.ground_truth_reachable = true;
  result.active_streams = groundTruth.activeStreamIds.size;
  result.ran = true;

  const openSessions = await sql`
    SELECT
      ss.id,
      ss.user_id,
      ss.mux_session_id,
      ss.started_at,
      u.username,
      u.is_live AS user_is_live,
      u.mux_stream_id AS user_mux_stream_id
    FROM stream_sessions ss
    INNER JOIN users u ON ss.user_id = u.id
    WHERE ss.ended_at IS NULL
    ORDER BY ss.started_at ASC
    LIMIT 500
  `;

  result.candidates_checked = openSessions.rows.length;

  for (const row of openSessions.rows) {
    const candidate: OpenSessionCandidate = {
      id: row.id,
      user_id: row.user_id,
      username: row.username,
      mux_stream_id: row.mux_session_id ?? row.user_mux_stream_id ?? null,
      started_at: row.started_at,
    };

    try {
      const decision = classifyOpenSession(candidate, groundTruth, {
        minOrphanAgeMs: config.minOrphanAgeMs,
      });

      if (decision.action === "keep_open") {
        if (candidate.mux_stream_id) {
          result.sessions_still_active++;
        } else {
          result.sessions_unverifiable++;
        }
        logger.info(
          `${ORPHAN_SESSION_LOG_MARKER} keeping session open: ${decision.reason}`,
          { sessionId: candidate.id }
        );
        continue;
      }

      // Staleness and the Mux list agree; re-check the single stream so a
      // broadcast that started after the snapshot is not closed.
      const streamCheck = await confirmStreamStopped(candidate.mux_stream_id!);
      if (streamCheck !== "inactive") {
        result.sessions_still_active++;
        logger.warn(
          `${ORPHAN_SESSION_LOG_MARKER} re-check says "${streamCheck}" — session left open`,
          { sessionId: candidate.id, streamId: candidate.mux_stream_id }
        );
        continue;
      }

      const closed = await sql`
        UPDATE stream_sessions
        SET ended_at = NOW(), ended_at_estimated = TRUE
        WHERE id = ${candidate.id} AND ended_at IS NULL
        RETURNING id, ended_at
      `;

      if (closed.rows.length === 0) {
        // A webhook closed it between the SELECT and this UPDATE — its
        // timestamp is precise, so leave it alone.
        result.sessions_already_closed++;
        continue;
      }

      const endedAt = closed.rows[0].ended_at
        ? new Date(closed.rows[0].ended_at).toISOString()
        : new Date().toISOString();

      // The session is provably not live in Mux; if the user's row still
      // claims otherwise, that is the same desync the reconciliation job
      // handles, corrected here against the identical ground truth.
      if (
        row.user_is_live &&
        (!row.user_mux_stream_id ||
          !groundTruth.activeStreamIds.has(row.user_mux_stream_id))
      ) {
        await sql`
          UPDATE users SET
            is_live = false,
            stream_started_at = NULL,
            current_viewers = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${candidate.user_id}
        `;
      }

      result.sessions_closed++;
      result.corrections.push({
        session_id: candidate.id,
        username: candidate.username,
        mux_stream_id: candidate.mux_stream_id!,
        started_at: candidate.started_at
          ? new Date(candidate.started_at).toISOString()
          : null,
        estimated_end: endedAt,
        age_minutes: decision.age_minutes,
      });

      logger.warn(
        `${ORPHAN_SESSION_LOG_MARKER} CORRECTION orphaned session closed`,
        {
          sessionId: candidate.id,
          username: candidate.username,
          streamId: candidate.mux_stream_id,
          estimatedEnd: endedAt,
          ageMinutes: decision.age_minutes,
          source: "orphan-session-reaper",
        }
      );
    } catch (sessionError) {
      result.sessions_with_errors++;
      logger.error(`${ORPHAN_SESSION_LOG_MARKER} failed to process session`, {
        sessionId: candidate.id,
        errorMessage:
          sessionError instanceof Error
            ? sessionError.message
            : String(sessionError),
      });
    }
  }

  if (result.sessions_closed >= config.alertThreshold) {
    result.alert = await sendOpsAlert({
      event: "orphan_session_reaper_abnormal_rate",
      corrections: result.sessions_closed,
      threshold: config.alertThreshold,
      sessions: result.corrections,
    });
  }

  logger.info(`${ORPHAN_SESSION_LOG_MARKER} run complete`, {
    candidatesChecked: result.candidates_checked,
    sessionsClosed: result.sessions_closed,
    stillActive: result.sessions_still_active,
    unverifiable: result.sessions_unverifiable,
    alreadyClosed: result.sessions_already_closed,
    errors: result.sessions_with_errors,
    alert: result.alert,
  });

  return result;
}
