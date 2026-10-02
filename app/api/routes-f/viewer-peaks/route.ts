import { NextRequest, NextResponse } from "next/server";
import { getSessionsForCreator } from "./seed";
import { getTopPeaks, parseLimit } from "./peaks";
import type { ViewerPeaksResponse } from "./types";

/**
 * GET /api/routes-f/viewer-peaks?creator_id=creator_a&limit=10
 *
 * Returns the top N peak concurrent viewer counts across a creator's streams.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const creatorId = searchParams.get("creator_id");
  const limitParam = searchParams.get("limit");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const limit = parseLimit(limitParam);
  if (limit === null) {
    return NextResponse.json(
      { error: "limit must be a positive integer" },
      { status: 400 }
    );
  }

  const sessions = getSessionsForCreator(creatorId);
  const peaks = getTopPeaks(sessions, limit);

  return NextResponse.json({ peaks } satisfies ViewerPeaksResponse);
}
