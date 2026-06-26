import { NextRequest, NextResponse } from "next/server";
import type {
  HandoffLogResponse,
  HandoffRequest,
  HandoffResponse,
} from "./types";
import { applyHandoff, getHandoffLog, getStream } from "./store";

/**
 * POST /api/routes-f/stream-handoff
 * Body: { stream_id, from_user_id, to_user_id }
 *
 * Hands control of a live stream from the current host (from_user_id) to
 * another permitted host (to_user_id). Validates that:
 *   - the stream exists
 *   - from_user_id is the current host (otherwise 403)
 *   - to_user_id is in the stream's hosts list
 *
 * On success returns { handed_off_at } and appends to the handoff log.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<HandoffRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { stream_id, from_user_id, to_user_id } = body;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }
  if (!from_user_id || typeof from_user_id !== "string") {
    return NextResponse.json(
      { error: "from_user_id is required" },
      { status: 400 }
    );
  }
  if (!to_user_id || typeof to_user_id !== "string") {
    return NextResponse.json(
      { error: "to_user_id is required" },
      { status: 400 }
    );
  }
  if (from_user_id === to_user_id) {
    return NextResponse.json(
      { error: "from_user_id and to_user_id must differ" },
      { status: 400 }
    );
  }

  const stream = getStream(stream_id);
  if (!stream) {
    return NextResponse.json(
      { error: `unknown stream_id: ${stream_id}` },
      { status: 404 }
    );
  }

  // Only the active host may initiate a handoff.
  if (stream.current_host_id !== from_user_id) {
    return NextResponse.json(
      { error: "from_user_id is not the current host" },
      { status: 403 }
    );
  }

  if (!stream.hosts.includes(to_user_id)) {
    return NextResponse.json(
      { error: "to_user_id is not in the hosts list" },
      { status: 400 }
    );
  }

  const entry = applyHandoff(stream_id, from_user_id, to_user_id);
  return NextResponse.json({
    handed_off_at: entry.handed_off_at,
  } satisfies HandoffResponse);
}

/**
 * GET /api/routes-f/stream-handoff?stream_id=...
 * Returns the append-only handoff log for the stream (oldest first).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const stream = getStream(streamId);
  if (!stream) {
    return NextResponse.json(
      { error: `unknown stream_id: ${streamId}` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    stream_id: streamId,
    log: getHandoffLog(streamId),
  } satisfies HandoffLogResponse);
}
