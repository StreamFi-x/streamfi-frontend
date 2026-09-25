import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";
import {
  LedgerHistoryTooLargeError,
  reconcileUserTipTotals,
} from "@/lib/stellar/tip-reconciliation";
import { verifySession } from "@/lib/auth/verify-session";
import { isAdmin } from "@/lib/admin-auth";
import { cacheHeaders } from "@/lib/cache";
import { markRecentWrite } from "@/lib/db/replica";
import { acquireLock } from "@/lib/single-flight-lock";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";

// A refresh walks the creator's whole Horizon payment history, so on top of
// reconcileUserTipTotals' version guard (which keeps concurrent writers
// correct) it is guarded against repeated and overlapping work
// (docs/rate-limiting.md):
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
// Long enough for a maximal (maxPages) history walk with retries; a crashed
// invocation frees it on expiry.
const REFRESH_LOCK_TTL_MS = 5 * 60_000;
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
      WHERE LOWER(username) = ${username.toLowerCase()}
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
      // Recalculate from the full ledger history (shared with the scheduled
      // reconciliation job). A concurrent writer bumps tip_totals_version, in
      // which case the recalculation is retried against the newer state.
      const result = await reconcileUserTipTotals(
        String(user.id),
        String(user.stellar_public_key),
        { getXlmUsdPrice, maxAttempts: 3 }
      );

      if (result.status === "not_found") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (result.status === "stale" || !result.totals) {
        return inProgress();
      }

      await evaluateAndAwardBadges(String(user.id));

      // tip_transactions feed replica-routed analytics (top tippers, tip
      // recap); the caller's next reads go to the primary.
      return markRecentWrite(
        NextResponse.json(
          {
            username: user.username,
            totalReceived: result.totals.totalReceived,
            totalCount: result.totals.totalCount,
            lastTipAt: result.totals.lastTipAt,
            refreshed: true,
            refreshedAt: new Date().toISOString(),
          },
          { headers: cacheHeaders("privateNoStore") }
        )
      );
    } finally {
      await lock.release();
    }
  } catch (error) {
    if (error instanceof LedgerHistoryTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Refresh total error:", error);
    return NextResponse.json(
      { error: "Failed to refresh tip totals" },
      { status: 500 }
    );
  }
}
