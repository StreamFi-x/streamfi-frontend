import { NextRequest, NextResponse } from "next/server";
import { getStreamsForCreator } from "./seedData";
import { computeDayPerformance } from "./utils";
import type { DayPerformanceResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const streams = getStreamsForCreator(creatorId);
  const days = computeDayPerformance(streams);

  return NextResponse.json({ days } as DayPerformanceResponse);
}
