import { NextRequest, NextResponse } from "next/server";
import {
  getLivePresence,
  recordViewerHeartbeat,
  removeViewerPresence,
} from "@/lib/realtime/presence";
import { verifyViewerSessionToken } from "@/lib/stream/viewer-session-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/streams/presence?streamId=...&limit=...
 * Returns queryable active presence list and counts.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("streamId");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  if (!streamId) {
    return NextResponse.json({ error: "streamId is required" }, { status: 400 });
  }

  try {
    const presence = await getLivePresence(streamId, { limit });
    return NextResponse.json(presence, {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
    });
  } catch (error) {
    console.error("[presence:get] Error:", error);
    return NextResponse.json({ error: "Failed to fetch presence" }, { status: 500 });
  }
}

/**
 * POST /api/streams/presence
 * Refreshes viewer presence heartbeat or records explicit leave.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { streamId, sessionId, userId, username, avatar, isAnonymous, action } =
      body ?? {};

    if (!streamId || !sessionId) {
      return NextResponse.json(
        { error: "streamId and sessionId are required" },
        { status: 400 }
      );
    }

    if (action === "leave") {
      await removeViewerPresence(streamId, sessionId);
      return NextResponse.json({ message: "Presence removed successfully" }, { status: 200 });
    }

    const snapshot = await recordViewerHeartbeat(streamId, {
      sessionId,
      userId,
      username,
      avatar,
      isAnonymous,
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("[presence:post] Error:", error);
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
}
