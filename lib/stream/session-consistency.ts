/**
 * Shared session-consistency helpers.
 *
 * Two problems live here, both of which need the same notion of "ground
 * truth" so the two jobs that consume it cannot disagree:
 *
 * 1. `users.is_live` drifts from what Mux actually reports (missing
 *    `video.live_stream.*` webhook delivery). Anything that wants to know
 *    whether a stream is *really* live must ask Mux, not the DB.
 * 2. `stream_sessions` rows can be left with `ended_at IS NULL` forever when
 *    the closing webhook is missed. Those rows are read as "this user has an
 *    active session", so they silently block new sessions from being created.
 *
 * The Mux live-stream list is the single source of truth for both: a stream
 * counts as live only when it appears in `GET /video/v1/live-streams?status[]=active`.
 * Elapsed time is only ever used as a *second* signal (staleness), never as a
 * reason to close a row on its own.
 *
 * Fail-closed rule: when Mux cannot be queried the callers must not guess.
 * `fetchMuxGroundTruth` reports `reachable: false` and every classification
 * that depends on it returns `keep_open`, so an API outage can never cause
 * the reaper to force-close a session that is actually mid-broadcast.
 */

import { sql } from "@vercel/postgres";

/** Log prefix shared by every correction the reaper makes. Grep-able on purpose. */
export const ORPHAN_SESSION_LOG_MARKER = "[orphan-session-reaper]";

/** Hard ceiling on how many Mux pages (100 streams each) we will walk. */
const MAX_MUX_PAGES = 5;

export interface MuxGroundTruth {
  /** false when Mux could not be queried — callers must not act on the set. */
  reachable: boolean;
  /** Live-stream IDs Mux currently reports as `active`. */
  activeStreamIds: Set<string>;
  /** Populated when `reachable` is false, for logging/alerting. */
  error?: string;
}

/**
 * Pull the set of live streams Mux currently reports as broadcasting.
 *
 * One API call (plus pagination) for the whole job, instead of one call per
 * open session — the same set answers "is this session's stream still live?"
 * for every candidate in a single run.
 */
export async function fetchMuxGroundTruth(): Promise<MuxGroundTruth> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    return {
      reachable: false,
      activeStreamIds: new Set(),
      error: "MUX_TOKEN_ID / MUX_TOKEN_SECRET not configured",
    };
  }

  const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  const activeStreamIds = new Set<string>();
  let cursor: string | undefined;

  try {
    for (let page = 0; page < MAX_MUX_PAGES; page++) {
      const url = new URL("https://api.mux.com/video/v1/live-streams");
      url.searchParams.set("limit", "100");
      url.searchParams.append("status[]", "active");
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          reachable: false,
          activeStreamIds: new Set(),
          error: `Mux live-streams list returned HTTP ${response.status}`,
        };
      }

      const body = (await response.json()) as {
        data?: Array<{ id?: string }>;
        next_cursor?: string;
      };

      for (const stream of body.data ?? []) {
        if (stream?.id) {
          activeStreamIds.add(stream.id);
        }
      }

      cursor = body.next_cursor || undefined;
      if (!cursor) {
        break;
      }
    }

    return { reachable: true, activeStreamIds };
  } catch (error) {
    return {
      reachable: false,
      activeStreamIds: new Set(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type StreamStoppedCheck = "inactive" | "active" | "unknown";

/**
 * Re-check a single stream immediately before force-closing its session.
 *
 * The list snapshot can be seconds old; a stream that started in that gap
 * would otherwise be closed while it is actually broadcasting. `unknown`
 * (network error, non-2xx, missing credentials) is deliberately *not*
 * treated as inactive — the caller keeps the session open.
 */
export async function confirmStreamStopped(
  streamId: string
): Promise<StreamStoppedCheck> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    return "unknown";
  }

  const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");

  try {
    const response = await fetch(
      `https://api.mux.com/video/v1/live-streams/${streamId}`,
      {
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return "unknown";
    }

    const body = (await response.json()) as { data?: { status?: string } };
    const status = body.data?.status;

    if (status === "active") {
      return "active";
    }
    if (status === "idle" || status === "disabled") {
      return "inactive";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export interface ReaperConfig {
  /** Staleness heuristic — a session younger than this is never force-closed. */
  minOrphanAgeMs: number;
  /** More corrections than this in one run is treated as abnormal. */
  alertThreshold: number;
  /** Optional ops webhook; corrections at an abnormal rate are POSTed here. */
  alertWebhookUrl?: string;
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Job configuration, read from the environment at call time (not module load)
 * so operators can tune it without a code change and tests can vary it.
 */
export function getReaperConfig(
  env: NodeJS.ProcessEnv = process.env
): ReaperConfig {
  return {
    minOrphanAgeMs:
      readPositiveInt(env.ORPHAN_SESSION_MIN_AGE_MINUTES, 15) * 60_000,
    alertThreshold: readPositiveInt(env.ORPHAN_SESSION_ALERT_THRESHOLD, 5),
    alertWebhookUrl:
      env.ORPHAN_SESSION_ALERT_WEBHOOK_URL || env.OPS_ALERT_WEBHOOK_URL,
  };
}

export interface OpenSessionCandidate {
  id: string;
  user_id: string;
  username: string;
  /** Effective Mux live-stream id: the row's own, falling back to the user's. */
  mux_stream_id: string | null;
  started_at: string | Date;
}

export type OrphanDecision =
  | { action: "keep_open"; reason: string }
  | { action: "force_close"; reason: string; age_minutes: number };

export interface ClassifyOptions {
  /** Staleness heuristic — a session younger than this is never force-closed. */
  minOrphanAgeMs: number;
  /** Injectable clock for deterministic tests. */
  now?: number;
}

/**
 * Decide what to do with a single open `stream_sessions` row.
 *
 * Order matters: Mux state wins over elapsed time. A session whose stream is
 * still in Mux's active set is kept open no matter how old the row looks.
 */
export function classifyOpenSession(
  session: OpenSessionCandidate,
  groundTruth: MuxGroundTruth,
  options: ClassifyOptions
): OrphanDecision {
  const now = options.now ?? Date.now();
  const startedAt = new Date(session.started_at).getTime();
  const ageMs = Number.isFinite(startedAt)
    ? now - startedAt
    : Number.POSITIVE_INFINITY;
  const ageMinutes = Math.floor(ageMs / 60_000);

  if (!groundTruth.reachable) {
    return {
      action: "keep_open",
      reason: "Mux ground truth unavailable — refusing to guess",
    };
  }

  if (!session.mux_stream_id) {
    return {
      action: "keep_open",
      reason: "no Mux stream id on the row — nothing to cross-check against",
    };
  }

  if (groundTruth.activeStreamIds.has(session.mux_stream_id)) {
    return { action: "keep_open", reason: "stream is active in Mux" };
  }

  if (ageMs < options.minOrphanAgeMs) {
    return {
      action: "keep_open",
      reason: `younger than the ${Math.round(
        options.minOrphanAgeMs / 60_000
      )}-minute staleness threshold`,
    };
  }

  return {
    action: "force_close",
    reason: "stream is not active in Mux and the session is stale",
    age_minutes: ageMinutes,
  };
}

/**
 * The active-session dedup check used when opening a new session.
 *
 * `ended_at IS NULL` is what makes a force-closed (estimated) row invisible
 * here — the reaper always writes `ended_at`, so a corrected orphan can never
 * keep blocking a legitimate new session.
 */
export async function hasOpenSession(userId: string): Promise<boolean> {
  const existing = await sql`
    SELECT id FROM stream_sessions
    WHERE user_id = ${userId} AND ended_at IS NULL
    LIMIT 1
  `;
  return existing.rows.length > 0;
}
