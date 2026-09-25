// app/api/tips/refresh-total/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { fetchPaymentsReceived, type TipRecord } from "@/lib/stellar/horizon";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";
import { verifySession } from "@/lib/auth/verify-session";
import { isAdmin } from "@/lib/admin-auth";
import { cacheHeaders } from "@/lib/cache";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { acquireLock } from "@/lib/single-flight-lock";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";

// A refresh walks the creator's entire Horizon payment history and writes
// every page, so it is guarded three ways (see docs/rate-limiting.md):
//  1. per caller: caps how many refreshes one account can start;
//  2. per creator cooldown: a refresh within the last minute is reused, not rerun;
//  3. per creator lock: overlapping refreshes of the same creator are refused.
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
// Long enough for a large history walk; a crashed invocation frees it on expiry.
const REFRESH_LOCK_TTL_MS = 5 * 60_000;
const IN_PROGRESS_RETRY_SECONDS = 10;
const HORIZON_PAGE_SIZE = 200;

async function recordTips(
  creatorId: string,
  tips: TipRecord[],
  xlmUsdPrice: number
): Promise<void> {
  if (tips.length === 0) {
    return;
  }
  // One statement per Horizon page instead of a lookup + insert per tip. The
  // partial unique index on tx_hash makes reruns idempotent.
  await sql`
    INSERT INTO tip_transactions (
      creator_id, supporter_id, amount_xlm, price_usd, tx_hash, memo, created_at
    )
    SELECT
      ${creatorId}::uuid, supporter.id, t.amount::numeric, ${xlmUsdPrice}::numeric,
      t."txHash", 'StreamFi Tip', t."timestamp"::timestamptz
    FROM json_to_recordset(${JSON.stringify(tips)}::json)
      AS t(amount text, "txHash" text, sender text, "timestamp" text)
    LEFT JOIN users supporter ON supporter.wallet = t.sender
    ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING
  `;
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

    const cooldown = await creatorCooldown.check(user.id);
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
      return NextResponse.json(
        {
          error: "A refresh for this creator is already in progress",
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

    try {
      const xlmUsdPrice = await getXlmUsdPrice();
      let total = 0;
      let totalCount = 0;
      let lastTipAt: string | null = null;
      let cursor: string | undefined;

      do {
        const { tips, nextCursor } = await fetchPaymentsReceived({
          publicKey: user.stellar_public_key,
          limit: HORIZON_PAGE_SIZE,
          cursor,
        });
        if (lastTipAt === null && tips.length > 0) {
          lastTipAt = tips[0].timestamp;
        }
        for (const tip of tips) {
          total += parseFloat(tip.amount);
        }
        totalCount += tips.length;
        await recordTips(user.id, tips, xlmUsdPrice);
        cursor = nextCursor || undefined;
      } while (cursor);

      const totalReceived = total.toFixed(7);

      await sql`
        UPDATE users
        SET
          total_tips_received = ${totalReceived},
          total_tips_count = ${totalCount},
          last_tip_at = ${lastTipAt},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;
      await invalidateUserCaches({
        id: user.id,
        username: user.username,
        wallet: user.stellar_public_key,
      });

      await evaluateAndAwardBadges(String(user.id));

      return NextResponse.json(
        {
          username: user.username,
          totalReceived,
          totalCount,
          lastTipAt,
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
