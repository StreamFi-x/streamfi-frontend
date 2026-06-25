import { NextRequest, NextResponse } from "next/server";
import type { Timeframe, RankedClip, MostLikedResponse } from "./types";
import { getClips } from "./seed";

const VALID_TIMEFRAMES: Timeframe[] = ["24h", "7d", "30d", "all-time"];

function timeframeCutoff(timeframe: Timeframe): number {
  const now = Date.now();
  const h = 60 * 60 * 1000;
  const d = 24 * h;
  switch (timeframe) {
    case "24h":
      return now - 24 * h;
    case "7d":
      return now - 7 * d;
    case "30d":
      return now - 30 * d;
    case "all-time":
      return 0;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id") ?? undefined;
  const timeframeParam = searchParams.get("timeframe") ?? "all-time";
  const limitParam = searchParams.get("limit");

  // Validate timeframe
  if (!VALID_TIMEFRAMES.includes(timeframeParam as Timeframe)) {
    return NextResponse.json(
      { error: `invalid timeframe, must be one of: ${VALID_TIMEFRAMES.join(", ")}` },
      { status: 400 }
    );
  }
  const timeframe = timeframeParam as Timeframe;

  // Validate limit
  let limit = 10;
  if (limitParam !== null) {
    const parsed = parseInt(limitParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: "limit must be an integer between 1 and 100" },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  const cutoff = timeframeCutoff(timeframe);
  const clips = getClips(creatorId).filter(c => c.created_at >= cutoff);

  // Sort by likes descending
  clips.sort((a, b) => b.likes - a.likes);

  const ranked: RankedClip[] = clips.slice(0, limit).map((clip, idx) => ({
    ...clip,
    rank: idx + 1,
  }));

  return NextResponse.json({
    clips: ranked,
    timeframe,
    total: ranked.length,
  } as MostLikedResponse);
}
