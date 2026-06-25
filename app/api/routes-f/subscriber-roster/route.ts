import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { validateQuery } from "../_lib/validate";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/subscriber-roster?creator_id=...
 * Get subscriber roster for a creator with tier breakdown and MRR
 */
export async function GET(req: NextRequest) {
  const queryResult = validateQuery(
    req.nextUrl.searchParams,
    z.object({ creator_id: z.string() })
  );

  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { creator_id } = queryResult.data;

  try {
    const { rows: subscribers } = await sql`
      SELECT
        id,
        user_id,
        subscription_tier_id,
        started_at,
        end_date,
        active
      FROM subscriptions
      WHERE creator_id = ${creator_id} AND active = true
      ORDER BY started_at DESC
    `;

    const { rows: tierRows } = await sql`
      SELECT id, price_usdc FROM subscription_tiers
      WHERE creator_id = ${creator_id} AND active = true
    `;

    const tierMap = new Map(tierRows.map((t: any) => [t.id, t.price_usdc]));

    const byTier: Record<string, number> = {};
    let totalMrrUsdc = 0;

    for (const sub of subscribers) {
      const tierId = sub.subscription_tier_id;
      byTier[tierId] = (byTier[tierId] || 0) + 1;

      const tierPrice = tierMap.get(tierId) || 0;
      totalMrrUsdc += tierPrice;
    }

    const monthlyRecurringRevenue = Math.round(totalMrrUsdc * 100) / 100;

    return NextResponse.json({
      subscribers,
      by_tier: byTier,
      monthly_recurring_revenue_usdc: monthlyRecurringRevenue,
    });
  } catch (error) {
    console.error("[Subscriber Roster API] Error fetching roster:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
