/**
 * GET /api/routes-f/clip-transcript-search?q=...&creator_id=...&limit=...
 *
 * Case-insensitive substring search over clip transcripts, optionally
 * scoped to a creator. Returns the clip id, a snippet of matched text, and
 * the timestamp within the clip where that text occurs.
 */
import { NextRequest, NextResponse } from "next/server";
import type { ClipTranscriptSearchResponse } from "./types";
import { searchClipTranscripts, DEFAULT_LIMIT } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const creatorId = searchParams.get("creator_id") ?? undefined;
  const limitParam = searchParams.get("limit");

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json(
        { error: "limit must be a positive integer" },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  const results = searchClipTranscripts({
    q,
    creator_id: creatorId,
    limit,
  });

  return NextResponse.json({ results } as ClipTranscriptSearchResponse);
}
