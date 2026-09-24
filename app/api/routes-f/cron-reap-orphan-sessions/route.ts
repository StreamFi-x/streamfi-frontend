/**
 * Cron job: reap orphaned stream sessions (#1402)
 *
 * POST /api/routes-f/cron-reap-orphan-sessions
 *
 * Finds `stream_sessions` rows with `ended_at IS NULL` that no longer
 * correspond to a genuinely active stream and force-closes them, flagging the
 * backfilled `ended_at` as estimated. Mux's live-stream list is the source of
 * truth (same one the is_live reconciliation job uses) — elapsed time alone is
 * only a staleness filter, never the reason to close a row.
 *
 * Security:
 * - Requires a CRON_SECRET bearer token, the internal API secret, or an admin
 *   session
 * - Rate limited
 *
 * Cron setup (Vercel) — add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/routes-f/cron-reap-orphan-sessions",
 *     "schedule": "0\/5 * * * *"
 *   }]
 * }
 *
 * Or an external scheduler with:
 * - URL: https://yourdomain.com/api/routes-f/cron-reap-orphan-sessions
 * - Method: POST
 * - Header: authorization: Bearer YOUR_CRON_SECRET
 *
 * Env knobs:
 * - ORPHAN_SESSION_MIN_AGE_MINUTES (default 15) — staleness threshold
 * - ORPHAN_SESSION_ALERT_THRESHOLD (default 5) — corrections per run above
 *   which the run is reported as abnormal and pushed to the ops webhook
 * - ORPHAN_SESSION_ALERT_WEBHOOK_URL (or OPS_ALERT_WEBHOOK_URL)
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  runOrphanSessionReaper,
  verifyCronAuthorization,
} from "@/lib/stream/orphan-session-reaper";
import { getReaperConfig } from "@/lib/stream/session-consistency";

// Rate limiter: max 12 requests per hour (every 5 minutes)
const isRateLimited = createRateLimiter(60 * 60 * 1000, 12);

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyCronAuthorization(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fixed bucket on purpose — the caller's credentials must not be used as
    // a rate-limit key.
    if (await isRateLimited("cron-reap-orphan-sessions")) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const result = await runOrphanSessionReaper();

    if (!result.ground_truth_reachable) {
      return NextResponse.json(
        {
          message: "Mux ground truth unavailable — no sessions were modified",
          ...result,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      message: "Orphaned session check completed",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check orphaned sessions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(req: NextRequest) {
  try {
    if (!(await verifyCronAuthorization(req))) {
      return NextResponse.json(
        {
          status: "ok",
          message: "Cron job endpoint is active",
          authorized: false,
        },
        { status: 401 }
      );
    }

    const config = getReaperConfig();
    const staleBefore = new Date(Date.now() - config.minOrphanAgeMs);

    const openSessions = await sql`
      SELECT COUNT(*) AS count
      FROM stream_sessions
      WHERE ended_at IS NULL
    `;

    const staleSessions = await sql`
      SELECT COUNT(*) AS count
      FROM stream_sessions
      WHERE ended_at IS NULL
        AND started_at < ${staleBefore.toISOString()}
    `;

    return NextResponse.json({
      status: "ok",
      message: "Cron job endpoint is active",
      authorized: true,
      staleness_threshold_minutes: config.minOrphanAgeMs / 60_000,
      alert_threshold: config.alertThreshold,
      statistics: {
        open_sessions: Number(openSessions.rows[0]?.count ?? 0),
        stale_open_sessions: Number(staleSessions.rows[0]?.count ?? 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to fetch statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
