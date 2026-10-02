/**
 * GET /api/routes-f/clip-density-heatmap?stream_id=...
 *
 * Buckets a stream's clips into 1-minute buckets (by seconds-from-stream-
 * start) so a UI can render a density heatmap of when clips were created,
 * and reports the minute with the most clips.
 */
import { NextRequest, NextResponse } from "next/server";
import type { ClipDensityHeatmapResponse } from "./types";
import { buildHeatmap } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const { buckets, peak_minute } = buildHeatmap(streamId);

  return NextResponse.json({
    stream_id: streamId,
    buckets,
    peak_minute,
  } as ClipDensityHeatmapResponse);
}
