import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";
import {
  LedgerHistoryTooLargeError,
  reconcileUserTipTotals,
} from "@/lib/stellar/tip-reconciliation";

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // TODO: Add authentication check here
    // Verify that the requesting user is the owner or admin

    // 1. Fetch user from database
    const userResult = await sql`
      SELECT id, username, wallet AS stellar_public_key
      FROM users
      WHERE LOWER(username) = ${username.toLowerCase()}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.stellar_public_key) {
      return NextResponse.json(
        { error: "User has not configured Stellar wallet" },
        { status: 400 }
      );
    }

    // 2. Recalculate from the full ledger history (shared with the scheduled
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
      return NextResponse.json(
        { error: "Tip totals are being updated; try again shortly" },
        { status: 409 }
      );
    }

    await evaluateAndAwardBadges(String(user.id));

    // 3. Return updated statistics
    return NextResponse.json({
      username: user.username,
      totalReceived: result.totals.totalReceived,
      totalCount: result.totals.totalCount,
      lastTipAt: result.totals.lastTipAt,
      refreshedAt: new Date().toISOString(),
    });
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
