import { NextResponse } from "next/server";
import {
  getSpikeLevelForStream,
  getPollIntervalSeconds,
} from "@/lib/chat-spike";

/**
 * GET /api/streams/chat/spike-level?streamerId=<uuid>
 *
 * Public endpoint — no authentication required. Viewers poll this to detect
 * whether the stream they are watching is in a load-spike state so the UI can
 * show the degradation banner.
 *
 * Query params:
 *   streamerId (required) — the creator's user id
 *
 * Response:
 *   { level, pollIntervalSeconds, slowModeEnforced }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const streamerId = searchParams.get("streamerId");

  if (!streamerId || !streamerId.trim()) {
    return NextResponse.json(
      { error: "streamerId is required" },
      { status: 400 }
    );
  }

  const level = await getSpikeLevelForStream(streamerId);
  const pollIntervalSeconds = getPollIntervalSeconds(level);
  const slowModeEnforced = level !== "normal";

  return NextResponse.json(
    { level, pollIntervalSeconds, slowModeEnforced },
    {
      status: 200,
      headers: {
        // Spike level changes slowly; 10 s stale is fine and avoids hammering
        // Redis for every viewer on every page load.
        "Cache-Control": "private, max-age=10",
        "X-Chat-Spike": level,
      },
    }
  );
}
