import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./seed";
import { summarizeSession } from "./summarize";

/**
 * GET /api/routes-f/stream-analytics?stream_id=stream_live_1
 *
 * Computes an analytics summary for a single live or past stream:
 * duration, peak/average/unique viewers, total messages and total tips (USDC).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const now = Date.now();
  const session = getSession(streamId, now);
  if (!session) {
    return NextResponse.json(
      { error: `unknown stream_id: ${streamId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(summarizeSession(session, now));
}
