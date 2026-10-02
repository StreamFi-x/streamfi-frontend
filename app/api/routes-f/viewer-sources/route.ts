import { NextRequest, NextResponse } from "next/server";
import type { ViewerSourcesResponse } from "./types";
import { sessionsForStream } from "./seed";
import { attributeSources } from "./attribution";

/**
 * GET /api/routes-f/viewer-sources?stream_id=stream_1
 *
 * Breaks a stream's viewers down by referrer source (direct, explore, social,
 * embed), sorted by viewer count descending, with each source's percentage of
 * the total.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;

  const streamId = params.get("stream_id");
  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const sessions = sessionsForStream(streamId);
  const { sources, total } = attributeSources(sessions);

  return NextResponse.json({ sources, total } as ViewerSourcesResponse);
}
