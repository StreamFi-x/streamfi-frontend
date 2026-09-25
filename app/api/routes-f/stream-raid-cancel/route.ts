/**
 * POST /api/routes-f/stream-raid-cancel
 * Body: { raid_id: string, channel_id: string }
 *
 * Cancels a raid while it is still in the pre-redirect countdown window.
 * Only the channel that initiated the raid may cancel it.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  cancelRaid,
  RaidNotFoundError,
  RaidNotOwnedError,
  RaidNotPendingError,
} from "./store";
import type { RaidCancelBody, RaidCancelResponse } from "./types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RaidCancelBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { raid_id, channel_id } = body ?? ({} as RaidCancelBody);

  if (!raid_id || typeof raid_id !== "string") {
    return NextResponse.json({ error: "raid_id is required" }, { status: 400 });
  }
  if (!channel_id || typeof channel_id !== "string") {
    return NextResponse.json({ error: "channel_id is required" }, { status: 400 });
  }

  try {
    const raid = cancelRaid(raid_id, channel_id);
    return NextResponse.json({ raid } satisfies RaidCancelResponse);
  } catch (error) {
    if (error instanceof RaidNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof RaidNotOwnedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RaidNotPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
