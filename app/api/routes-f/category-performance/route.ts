import { NextRequest, NextResponse } from "next/server";
import type { CategoryPerformanceResponse } from "./types";
import { streamsForCreator } from "./seed";
import { aggregateByCategory } from "./aggregate";

/**
 * GET /api/routes-f/category-performance?creator_id=creator_a
 *
 * Aggregates a creator's stream performance by category: stream count plus
 * average viewers and average tips (USDC) per stream, sorted by stream count
 * descending.
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

  const streams = streamsForCreator(creatorId);
  const categories = aggregateByCategory(streams);

  return NextResponse.json({ categories } as CategoryPerformanceResponse);
}
