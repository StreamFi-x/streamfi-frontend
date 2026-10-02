/**
 * GET /api/routes-f/tip-goal-history?creator_id=<id>
 * Returns past (resolved) tip goals for a channel, with final status and
 * total raised, most recently ended first.
 */
import { NextRequest, NextResponse } from "next/server";
import { getGoalHistoryForCreator } from "./seedData";
import { sortByEndedAtDesc } from "./utils";
import type { TipGoalHistoryResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const goals = sortByEndedAtDesc(getGoalHistoryForCreator(creatorId));

  return NextResponse.json({ goals } as TipGoalHistoryResponse);
}
