import { NextRequest, NextResponse } from "next/server";
import { getChatStream } from "./seed";
import { computeVelocity } from "./velocity";
import type { ChatVelocityResponse } from "./types";

/**
 * GET /api/routes-f/chat-velocity?stream_id=stream_chat_1
 *
 * Computes chat messages per minute for a stream, including peak minute.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const stream = getChatStream(streamId);
  if (!stream) {
    return NextResponse.json(
      { error: `unknown stream_id: ${streamId}` },
      { status: 404 }
    );
  }

  const result = computeVelocity(stream.events);
  return NextResponse.json(result satisfies ChatVelocityResponse);
}
