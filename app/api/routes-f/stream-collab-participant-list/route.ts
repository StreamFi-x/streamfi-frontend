/**
 * GET /api/routes-f/stream-collab-participant-list?collab_session_id=...
 * Returns the current participants of a stream collab session, active or
 * ended.
 */
import { NextRequest, NextResponse } from "next/server";
import type { ParticipantListResponse } from "./types";
import { getSession, SessionNotFoundError } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const collabSessionId = req.nextUrl.searchParams.get("collab_session_id");

  if (!collabSessionId) {
    return NextResponse.json(
      { error: "collab_session_id is required" },
      { status: 400 }
    );
  }

  try {
    const session = getSession(collabSessionId);

    return NextResponse.json({
      collab_session_id: session.collab_session_id,
      stream_id: session.stream_id,
      status: session.status,
      participants: session.participants,
    } as ParticipantListResponse);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
