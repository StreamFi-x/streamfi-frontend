import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getSeedCreatorStats } from "./_lib/seed";

const querySchema = z.object({
  creator_id: z.string().min(1),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { creator_id } = queryResult.data;
  const stats = getSeedCreatorStats(creator_id);
  if (!stats) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  return NextResponse.json({
    creator_id: stats.creator_id,
    follower_count: stats.follower_count,
    monthly_recurring_revenue_usdc:
      Math.round(stats.monthly_recurring_revenue_usdc * 100) / 100,
    last_stream_at: stats.last_stream_at,
    total_tips_lifetime_usdc:
      Math.round(stats.total_tips_lifetime_usdc * 100) / 100,
    active_subs: stats.active_subs,
  });
}