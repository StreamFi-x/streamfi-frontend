/**
 * GET /api/routes-f/stream-highlight-reel?creator_id=<id>
 *
 * Returns auto-detected highlight timestamps from a creator's last live
 * session, ranked by chat activity and tip volume.
 */
import { NextRequest, NextResponse } from "next/server";
import { getLastSessionForCreator } from "./seed";
import { detectHighlights } from "./highlights";
import type { StreamHighlightReelResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creator_id = searchParams.get("creator_id");

  if (!creator_id) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const session = getLastSessionForCreator(creator_id);
  if (!session) {
    return NextResponse.json(
      { error: `no session found for creator_id: ${creator_id}` },
      { status: 404 }
    );
  }

  const highlights = detectHighlights(session);
  return NextResponse.json({
    creator_id: session.creator_id,
    stream_id: session.stream_id,
    ended_at: session.ended_at,
    highlights,
  } satisfies StreamHighlightReelResponse);
}
