import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";
import { reconcileUserTipTotals } from "@/lib/stellar/tip-reconciliation";
import { tipRefreshCreatorJob } from "@/lib/jobs/definitions/tip-reconciliation";
import { dispatchJob } from "@/lib/jobs/qstash";
import { CircuitOpenError } from "@/lib/resilience/circuit-breaker";
import { verifySession } from "@/lib/auth/verify-session";
import { isAdmin } from "@/lib/admin-auth";
import { cacheHeaders } from "@/lib/cache";
import { acquireLock } from "@/lib/single-flight-lock";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";

export const maxDuration = 30;

// A refresh advances the creator's resumable ledger walk (checkpointed, so
// concurrent writers stay correct) for a bounded time. A history too long to
// finish within the request continues in the background job
// tip-refresh-creator (docs/background-jobs.md). Repeated and overlapping
// work is still refused (docs/rate-limiting.md):
//  1. per caller: caps how many refreshes one account can start;
//  2. per creator cooldown: a refresh within the last minute is reused, not rerun;
//  3. per creator lock: overlapping walks of the same creator are refused.
const callerLimit = createRateLimit({
  namespace: "tips-refresh:caller",
  limit: 10,
  windowMs: 10 * 60_000,
});
const creatorCooldown = createRateLimit({
  namespace: "tips-refresh:creator",
  limit: 1,
  windowMs: 60_000,
});
// Pages are read for at most this long; with the Horizon breaker's per-call
// timeout (8s) a refresh answers within about 15s even when Horizon hangs.
const REFRESH_TIME_BUDGET_MS = 6_000;
const REFRESH_MAX_PAGES = 10;
// Covers the budget plus one in-flight page; a crashed invocation frees it on
// expiry.
const REFRESH_LOCK_TTL_MS = 30_000;
const IN_PROGRESS_RETRY_SECONDS = 10;

function inProgress(): NextResponse {
  return NextResponse.json(
    {
      error: "Tip totals are being updated; try again shortly",
      retryAfter: IN_PROGRESS_RETRY_SECONDS,
    },
    {
      status: 409,
      headers: {
        "Retry-After": String(IN_PROGRESS_RETRY_SECONDS),
        ...cacheHeaders("privateNoStore"),
      },
    }
  );
}

/**
 * Horizon failed or its circuit is open: answer at once instead of waiting.
 * Pages already read are saved and the next refresh resumes from them.
 */
function ledgerUnavailable(error: unknown): NextResponse {
  const retryAfter =
    error instanceof CircuitOpenError
      ? Math.max(1, Math.ceil(error.retryAfterMs / 1000))
      : IN_PROGRESS_RETRY_SECONDS;
  return NextResponse.json(
    {
      error:
        "The Stellar network is not responding; your tip totals will refresh shortly",
      retryAfter,
    },
    {
      status: 503,
      headers: {
        "Retry-After": String(retryAfter),
        ...cacheHeaders("privateNoStore"),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  let username: string;
  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username.trim() : "";
  } catch {
    username = "";
  }
  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 }
    );
  }

  const callerCheck = await callerLimit.check(session.userId);
  if (!callerCheck.success) {
    return tooManyRequests(callerCheck, "Too many refresh requests");
  }

  try {
    const userResult = await sql`
      SELECT id, username, wallet AS stellar_public_key,
             total_tips_received, total_tips_count, last_tip_at
      FROM users
      WHERE LOWER(username) = ${username.toLowerCase()} AND deleted_at IS NULL
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const callerIsAdmin =
      (!!session.privyId && isAdmin(session.privyId)) ||
      (!!session.wallet && isAdmin(session.wallet));
    if (user.id !== session.userId && !callerIsAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!user.stellar_public_key) {
      return NextResponse.json(
        { error: "User has not configured Stellar wallet" },
        { status: 400 }
      );
    }

    const cooldown = await creatorCooldown.check(String(user.id));
    if (!cooldown.success) {
      return NextResponse.json(
        {
          username: user.username,
          totalReceived: String(user.total_tips_received ?? "0.0000000"),
          totalCount: Number(user.total_tips_count ?? 0),
          lastTipAt: user.last_tip_at ?? null,
          refreshed: false,
          retryAfter: cooldown.retryAfterSeconds,
        },
        { headers: cacheHeaders("privateNoStore") }
      );
    }

    const lock = await acquireLock(`tips-refresh:${user.id}`, {
      ttlMs: REFRESH_LOCK_TTL_MS,
    });
    if (!lock) {
      return inProgress();
    }

    try {
      const result = await reconcileUserTipTotals(
        String(user.id),
        String(user.stellar_public_key),
        {
          getXlmUsdPrice,
          maxPages: REFRESH_MAX_PAGES,
          timeBudgetMs: REFRESH_TIME_BUDGET_MS,
        }
      );

      switch (result.status) {
        case "not_found":
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        case "stale":
        case "superseded":
          return inProgress();
        case "interrupted":
          return ledgerUnavailable(result.error);
        case "in_progress": {
          // Progress so far is saved; finish in the background.
          const continuation = await dispatchJob(
            tipRefreshCreatorJob,
            { userId: String(user.id) },
            {
              deduplicationId: `tip-refresh-creator:${user.id}:${result.cursor ?? "start"}`,
            }
          );
          return NextResponse.json(
            {
              username: user.username,
              totalReceived: String(user.total_tips_received ?? "0.0000000"),
              totalCount: Number(user.total_tips_count ?? 0),
              lastTipAt: user.last_tip_at ?? null,
              refreshed: false,
              status: "in_progress",
              continuesInBackground: continuation.dispatched,
              retryAfter: IN_PROGRESS_RETRY_SECONDS,
            },
            { status: 202, headers: cacheHeaders("privateNoStore") }
          );
        }
        case "complete":
          break;
      }
      if (!result.totals) {
        return inProgress();
      }

      await evaluateAndAwardBadges(String(user.id));

      return NextResponse.json(
        {
          username: user.username,
          totalReceived: result.totals.totalReceived,
          totalCount: result.totals.totalCount,
          lastTipAt: result.totals.lastTipAt,
          refreshed: true,
          refreshedAt: new Date().toISOString(),
        },
        { headers: cacheHeaders("privateNoStore") }
      );
    } finally {
      await lock.release();
    }
  } catch (error) {
    console.error("Refresh total error:", error);
    return NextResponse.json(
      { error: "Failed to refresh tip totals" },
      { status: 500 }
    );
  }
}
