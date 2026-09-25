/**
 * POST /api/routes-f/highlight-reel
 * Body: { stream_id: string }
 * Returns: { highlights: Highlight[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { getStream } from "./seed";
import { pickTopHighlights } from "./highlights";
import type { HighlightReelResponse } from "./types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stream_id } = (body ?? {}) as Record<string, unknown>;
  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  const stream = getStream(stream_id);
  if (!stream) {
    return NextResponse.json({ error: `unknown stream_id: ${stream_id}` }, { status: 404 });
  }

  const highlights = pickTopHighlights(stream);
  return NextResponse.json({ stream_id, highlights } satisfies HighlightReelResponse);
}
