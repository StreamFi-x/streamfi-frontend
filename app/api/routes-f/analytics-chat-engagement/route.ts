import { NextRequest, NextResponse } from "next/server";
import { getChatLog } from "./seed";
import { summarizeChatEngagement } from "./summarize";

/**
 * GET /api/routes-f/analytics-chat-engagement?stream_id=stream_completed_1
 *
 * Returns messages-per-unique-chatter engagement stats for a single stream:
 * total messages, unique chatter count, and a per-chatter breakdown sorted
 * by message count descending.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const log = getChatLog(streamId);
  if (!log) {
    return NextResponse.json(
      { error: `unknown stream_id: ${streamId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(summarizeChatEngagement(log));
}
