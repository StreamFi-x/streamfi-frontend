// app/api/tips/refresh-total/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";

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

    // Snapshot existing tip totals so an empty Horizon page cannot wipe them (#1614).
    const priorTotals = await sql`
      SELECT total_tips_received, total_tips_count, last_tip_at
      FROM users
      WHERE id = ${user.id}
    `;
    const priorRow = priorTotals.rows[0] ?? {};
    const priorCount = Number(priorRow.total_tips_count ?? 0);
    const priorReceived = String(priorRow.total_tips_received ?? "0");
    const priorLastTipAt = priorRow.last_tip_at ?? null;

    // 2. Fetch all tips from Horizon API
    let allTips: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const {
        tips,
        nextCursor,
      }: { tips: any[]; nextCursor: string | undefined } =
        await fetchPaymentsReceived({
          publicKey: user.stellar_public_key,
          limit: 200,
          cursor,
        });

      allTips = [...allTips, ...tips];
      cursor = nextCursor || undefined;
      hasMore = !!nextCursor;
    }

    // 3. Calculate totals
    const totalReceived = allTips
      .reduce((sum, tip) => {
        return sum + parseFloat(tip.amount);
      }, 0)
      .toFixed(7);

    const totalCount = allTips.length;
    const lastTipAt = allTips.length > 0 ? allTips[0].timestamp : null;
    const xlmUsdPrice = await getXlmUsdPrice();

    for (const tip of allTips) {
      const supporterResult = await sql`
        SELECT id
        FROM users
        WHERE wallet = ${tip.sender}
        LIMIT 1
      `;

      await sql`
        INSERT INTO tip_transactions (
          creator_id,
          supporter_id,
          amount_xlm,
          price_usd,
          tx_hash,
          memo,
          created_at
        )
        VALUES (
          ${user.id},
          ${supporterResult.rows[0]?.id ?? null},
          ${tip.amount},
          ${xlmUsdPrice},
          ${tip.txHash},
          'StreamFi Tip',
          ${tip.timestamp}
        )
        ON CONFLICT (tx_hash) DO NOTHING
      `;
    }

    // 4. Update database — never overwrite real totals with an empty Horizon result.
    if (totalCount === 0 && priorCount > 0) {
      return NextResponse.json({
        username: user.username,
        totalReceived: priorReceived,
        totalCount: priorCount,
        lastTipAt: priorLastTipAt,
        refreshedAt: new Date().toISOString(),
        warning:
          "Horizon returned no tips; refusing to zero existing tip totals. Retry later or check wallet/network.",
      });
    }

    await sql`
      UPDATE users
      SET 
        total_tips_received = ${totalReceived},
        total_tips_count = ${totalCount},
        last_tip_at = ${lastTipAt},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;

    await evaluateAndAwardBadges(String(user.id));

    // 5. Return updated statistics
    return NextResponse.json({
      username: user.username,
      totalReceived,
      totalCount,
      lastTipAt,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Refresh total error:", error);
    return NextResponse.json(
      { error: "Failed to refresh tip totals" },
      { status: 500 }
    );
  }
}
