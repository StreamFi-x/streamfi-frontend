import { NextResponse } from "next/server";
import {
  buildLeaderboardResponse,
  parsePositiveInteger,
  parseTimeframe,
} from "./_lib/service";

export function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = parseTimeframe(searchParams.get("timeframe"));
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, "limit");
    const page = parsePositiveInteger(searchParams.get("page"), 1, "page");

    const payload = buildLeaderboardResponse({
      timeframe,
      limit,
      page,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to build leaderboard",
      },
      { status: 400 }
    );
  }
}
