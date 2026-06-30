/**
 * GET /api/routes-f/gift-sub-progress?stream_id=<id>
 * Returns gift-sub milestone progress for an active stream.
 */
import { NextRequest, NextResponse } from "next/server";
import { giftCounts, computeProgress } from "./store";
import type { GiftSubProgress } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const stream_id = req.nextUrl.searchParams.get("stream_id");
  if (!stream_id) {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  if (!giftCounts.has(stream_id)) {
    return NextResponse.json({ error: `unknown stream_id: ${stream_id}` }, { status: 404 });
  }

  const count = giftCounts.get(stream_id)!;
  const progress: GiftSubProgress = computeProgress(count);
  return NextResponse.json(progress);
}
