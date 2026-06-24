import { NextRequest, NextResponse } from "next/server";
import { getTipsForCreator } from "./seedData";
import {
  isValidTimeframe,
  filterTipsByTimeframe,
  buildLeaderboard,
  validateLimit,
} from "./utils";
import type { LeaderboardResponse, Timeframe } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  const timeframe = searchParams.get("timeframe");
  const limit = searchParams.get("limit");

  // Validate creator_id
  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  // Validate timeframe
  if (!timeframe) {
    return NextResponse.json(
      { error: "timeframe is required (daily|weekly|monthly|all-time)" },
      { status: 400 }
    );
  }

  if (!isValidTimeframe(timeframe)) {
    return NextResponse.json(
      {
        error:
          "invalid timeframe, must be one of: daily, weekly, monthly, all-time",
      },
      { status: 400 }
    );
  }

  // Validate limit
  const limitValidation = validateLimit(limit);
  if (!limitValidation.valid) {
    return NextResponse.json({ error: limitValidation.error }, { status: 400 });
  }

  const finalLimit = limitValidation.value || 10;

  // Get tips for creator
  const allTips = getTipsForCreator(creatorId);

  // Filter by timeframe
  const filteredTips = filterTipsByTimeframe(allTips, timeframe as Timeframe);

  // Build and limit leaderboard
  const fullLeaderboard = buildLeaderboard(filteredTips);
  const limitedLeaderboard = fullLeaderboard.slice(0, finalLimit);

  return NextResponse.json({
    entries: limitedLeaderboard,
  } as LeaderboardResponse);
}
