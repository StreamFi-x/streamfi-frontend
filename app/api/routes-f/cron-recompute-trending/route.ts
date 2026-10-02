/**
 * POST /api/routes-f/cron-recompute-trending (#1559)
 *
 * Vercel Cron endpoint. Recomputes the trending streams ranking table every
 * 5 minutes, using the same score formula as GET /api/routes-f/trending-streams
 * (score = current_viewers * 0.6 + viewer_velocity * 0.4), then persists the
 * ranked result to a dedicated ranking table rather than recomputing it on
 * every read — this is the write side of that read-only route.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSourceStreams, setRankingTable } from "./store";
import type { TrendingRankingRow } from "./types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {return false;}

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const computedAt = new Date().toISOString();
    const streams = getSourceStreams();

    const scored = streams
      .map((stream) => {
        const viewer_velocity = stream.current_viewers - stream.past_viewers;
        const score = stream.current_viewers * 0.6 + viewer_velocity * 0.4;
        return { stream, score, viewer_velocity };
      })
      .sort((a, b) => b.score - a.score);

    const ranking: TrendingRankingRow[] = scored.map(
      ({ stream, score, viewer_velocity }, index) => ({
        stream_id: stream.id,
        title: stream.title,
        creator: stream.creator,
        rank: index + 1,
        score,
        viewer_velocity,
        computed_at: computedAt,
      })
    );

    setRankingTable(ranking);

    return NextResponse.json({
      computed_at: computedAt,
      ranked_count: ranking.length,
      ranking,
    });
  } catch (error) {
    console.error("[cron-recompute-trending] failed:", error);
    return NextResponse.json(
      { error: "Failed to recompute trending ranking" },
      { status: 500 }
    );
  }
}
