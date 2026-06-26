import { NextRequest, NextResponse } from "next/server";
import type { FollowerGrowthResponse, Granularity } from "./types";
import { eventsForCreator } from "./seed";
import { buildGrowthSeries } from "./buckets";

const VALID_GRANULARITIES: Granularity[] = ["day", "week", "month"];
const DEFAULT_GRANULARITY: Granularity = "day";

/**
 * GET /api/routes-f/follower-growth?creator_id=creator_a&granularity=day|week|month
 *
 * Returns a cumulative follower growth time series bucketed at the requested
 * granularity, plus the total follower count.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;

  const creatorId = params.get("creator_id");
  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  let granularity = DEFAULT_GRANULARITY;
  const granularityRaw = params.get("granularity");
  if (granularityRaw !== null) {
    if (!VALID_GRANULARITIES.includes(granularityRaw as Granularity)) {
      return NextResponse.json(
        { error: `granularity must be one of: ${VALID_GRANULARITIES.join(", ")}` },
        { status: 400 }
      );
    }
    granularity = granularityRaw as Granularity;
  }

  const events = eventsForCreator(creatorId);
  const { series, total } = buildGrowthSeries(events, granularity);

  return NextResponse.json({ series, total } as FollowerGrowthResponse);
}
