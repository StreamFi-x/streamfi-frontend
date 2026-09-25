/**
 * GET /api/routes-f/creator-dashboard?creator_id=
 *
 * Returns roll-up metrics for a creator's dashboard home page.
 *
 * Query params:
 *   creator_id — required
 *
 * Response:
 *   {
 *     follower_count:                  number,
 *     monthly_recurring_revenue_usdc:  number,  // rounded to 2 decimals
 *     last_stream_at:                  string | null,
 *     total_tips_lifetime_usdc:        number,  // rounded to 2 decimals
 *     active_subs:                     number
 *   }
 *
 * Error responses:
 *   400 — missing/invalid query params
 *   404 — creator not found
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { SEED_STATS } from "./seed";
import { buildDashboardResponse } from "./aggregators";

const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) {return queryResult;}

  const { creator_id } = queryResult.data;
  const stats = SEED_STATS[creator_id];

  if (!stats) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  return NextResponse.json(buildDashboardResponse(stats));
}
