/**
 * POST /api/routes-f/stream-collab-invite-decline
 * Declines a pending stream collaboration invite. Only the invited creator
 * (the invite's recipient) may decline it, and only while it is still
 * pending.
 */
import { NextRequest, NextResponse } from "next/server";
import type { InviteDeclineBody, InviteDeclineResponse } from "./types";
import {
  declineInvite,
  InviteNotFoundError,
  InviteNotPendingError,
  InviteNotRecipientError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: InviteDeclineBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { invite_id, creator_id } = body;

  if (!invite_id || typeof invite_id !== "string") {
    return NextResponse.json(
      { error: "invite_id is required" },
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
    const invite = declineInvite(invite_id, creator_id);

    return NextResponse.json({ invite } as InviteDeclineResponse);
  } catch (error) {
    if (error instanceof InviteNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InviteNotRecipientError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof InviteNotPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
