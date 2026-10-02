/**
 * GET /api/routes-f/badge-my-earned?viewer_id=<id>
 * Returns badges the current user has earned across all channels, most
 * recently earned first. This mock has no real session auth, so the caller
 * (the "current user") is identified by viewer_id, matching the pattern
 * used by the other routes-f mocks.
 */
import { NextRequest, NextResponse } from "next/server";
import type { MyEarnedBadgesResponse } from "./types";
import { getEarnedBadgesForViewer } from "./seedData";
import { sortByEarnedAtDesc, toEarnedEntry } from "./utils";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");

  if (!viewerId || !viewerId.trim()) {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  const records = sortByEarnedAtDesc(
    getEarnedBadgesForViewer(viewerId.trim())
  );

  return NextResponse.json({
    badges: records.map(toEarnedEntry),
  } as MyEarnedBadgesResponse);
}
