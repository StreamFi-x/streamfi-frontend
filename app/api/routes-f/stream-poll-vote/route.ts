/**
 * POST /api/routes-f/stream-poll-vote
 * A viewer casts a vote on an open stream poll. Votes are rejected once
 * the poll's deadline has passed.
 */
import { NextRequest, NextResponse } from "next/server";
import type { VotePollBody, VotePollResponse } from "./types";
import {
  castVote,
  AlreadyVotedError,
  InvalidChoiceIndexError,
  PollDeadlinePassedError,
  PollNotFoundError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: VotePollBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { poll_id, choice_index, viewer_id } = body;

  if (!poll_id || typeof poll_id !== "string") {
    return NextResponse.json({ error: "poll_id is required" }, { status: 400 });
  }
  if (typeof choice_index !== "number" || !Number.isInteger(choice_index)) {
    return NextResponse.json(
      { error: "choice_index is required and must be an integer" },
      { status: 400 }
    );
  }
  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  try {
    const { votes } = castVote(poll_id, choice_index, viewer_id);
    return NextResponse.json({
      poll_id,
      choice_index,
      votes,
    } as VotePollResponse);
  } catch (error) {
    if (error instanceof PollNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PollDeadlinePassedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof InvalidChoiceIndexError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AlreadyVotedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
