/**
 * POST /api/routes-f/stream-raid-initiate
 * Starts a raid from the caller's channel to a target channel. Viewers are
 * redirected to the target channel after a 10 second delay (`redirect_at`),
 * giving the raid a brief pending window before it takes effect — see
 * stream-raid-cancel, which can cancel a raid while it is still pending.
 */
import { NextRequest, NextResponse } from "next/server";
import type { RaidInitiateBody, RaidInitiateResponse } from "./types";
import { initiateRaid, SelfRaidError } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RaidInitiateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { channel_id, targetChannelId } = body;

  if (!channel_id || typeof channel_id !== "string") {
    return NextResponse.json(
      { error: "channel_id is required" },
      { status: 400 }
    );
  }
  if (!targetChannelId || typeof targetChannelId !== "string") {
    return NextResponse.json(
      { error: "targetChannelId is required" },
      { status: 400 }
    );
  }

  try {
    const raid = initiateRaid(channel_id, targetChannelId);
    return NextResponse.json({ raid } as RaidInitiateResponse, { status: 201 });
  } catch (error) {
    if (error instanceof SelfRaidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
