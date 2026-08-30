/**
 * DELETE /api/routes-f/stream-host-mode-clear?channel_id=<id>
 *
 * Removes the currently hosted channel, taking the channel out of host mode.
 */
import { NextRequest, NextResponse } from "next/server";
import { clearHostMode, ChannelNotFoundError, NotHostingError } from "./store";
import type { StreamHostModeClearResponse } from "./types";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const channel_id = searchParams.get("channel_id");

  if (!channel_id) {
    return NextResponse.json({ error: "channel_id is required" }, { status: 400 });
  }

  try {
    const { state, cleared_channel_id } = clearHostMode(channel_id);

    return NextResponse.json({
      channel_id: state.channel_id,
      hosted_channel_id: null,
      cleared_channel_id,
    } satisfies StreamHostModeClearResponse);
  } catch (error) {
    if (error instanceof ChannelNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NotHostingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
