import { NextRequest, NextResponse } from "next/server";
import { getActiveOutgoingRaid } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/live/raid/active?channel=<username_or_id>
 * Public endpoint for channel viewers to check for an active outgoing raid banner.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = searchParams.get("channel");

  if (!channel) {
    return NextResponse.json({ error: "channel query parameter is required" }, { status: 400 });
  }

  const raidPrompt = getActiveOutgoingRaid(channel);
  return NextResponse.json({ active_raid: raidPrompt });
}
