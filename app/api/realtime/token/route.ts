/**
 * POST /api/realtime/token
 *
 * Mints a scoped token for realtime channel subscriptions.
 * Validates whether the user is authorized to subscribe to each requested channel.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { mintRealtimeToken, isChannelAllowedForUser } from "@/lib/realtime/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channels: string[] = Array.isArray(body?.channels) ? body.channels : [];

    if (channels.length === 0) {
      return NextResponse.json(
        { error: "At least one channel must be specified" },
        { status: 400 }
      );
    }

    // Attempt to verify session (optional for public channels)
    const session = await verifySession(req);
    const user = session.ok
      ? { userId: session.userId, wallet: session.wallet }
      : undefined;

    // Verify all requested channels
    const unauthorized = channels.filter(
      (ch) => !isChannelAllowedForUser(ch, user)
    );

    if (unauthorized.length > 0) {
      return NextResponse.json(
        {
          error: "Unauthorized channel subscription requested",
          unauthorizedChannels: unauthorized,
        },
        { status: 403 }
      );
    }

    const token = mintRealtimeToken(channels, user);

    return NextResponse.json({
      token,
      channels,
      expiresIn: 3600,
    });
  } catch (err) {
    console.error("[realtime/token] Error minting token:", err);
    return NextResponse.json(
      { error: "Failed to mint realtime token" },
      { status: 500 }
    );
  }
}
