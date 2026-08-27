/**
 * POST /api/routes-f/stream-host-mode
 *
 * Lets a creator embed another live stream (target_channel_id) on their own
 * channel page. Body: { channel_id, target_channel_id }.
 *
 * Response 200: { channel_id, hosted_channel_id, started_at }
 *
 * Error responses:
 *   400 — missing/invalid body, or channel_id === target_channel_id
 *   404 — channel_id or target_channel_id does not exist
 */
import { NextRequest, NextResponse } from "next/server";
import {
  setHostMode,
  ChannelNotFoundError,
  TargetChannelNotFoundError,
  SelfHostError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { channel_id?: unknown; target_channel_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { channel_id, target_channel_id } = body;

  if (!channel_id || typeof channel_id !== "string") {
    return NextResponse.json(
      { error: "channel_id is required and must be a string" },
      { status: 400 },
    );
  }
  if (!target_channel_id || typeof target_channel_id !== "string") {
    return NextResponse.json(
      { error: "target_channel_id is required and must be a string" },
      { status: 400 },
    );
  }

  try {
    const { state } = setHostMode(channel_id, target_channel_id);
    return NextResponse.json({
      channel_id: state.channel_id,
      hosted_channel_id: state.hosted_channel_id,
      started_at: state.started_at,
    });
  } catch (error) {
    if (error instanceof SelfHostError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error instanceof ChannelNotFoundError ||
      error instanceof TargetChannelNotFoundError
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
