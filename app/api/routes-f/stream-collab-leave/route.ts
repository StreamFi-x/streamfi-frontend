/**
 * POST /api/routes-f/stream-collab-leave
 * Lets a participant leave an active stream collab session.
 *
 * If the host leaves, the session ends for everyone (no host-promotion in
 * this route). If the last remaining participant leaves, the session also
 * ends. Otherwise the departing participant is removed and the session
 * stays active.
 */
import { NextRequest, NextResponse } from "next/server";
import type { LeaveBody, LeaveResponse } from "./types";
import {
  leaveSession,
  SessionNotFoundError,
  SessionNotActiveError,
  NotAParticipantError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: LeaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { collab_session_id, creator_id } = body;

  if (!collab_session_id || typeof collab_session_id !== "string") {
    return NextResponse.json(
      { error: "collab_session_id is required" },
      { status: 400 }
    );
  }
  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  try {
    const session = leaveSession(collab_session_id, creator_id);

    return NextResponse.json({
      collab_session_id: session.collab_session_id,
      status: session.status,
      participants: session.participants,
    } as LeaveResponse);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NotAParticipantError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof SessionNotActiveError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
