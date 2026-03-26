/**
 * POST /api/streams/access/check
 *
 * Server-side token-gate check. The client sends the streamer's username and
 * the viewer's wallet address (from the viewer's own session cookie). The
 * server verifies the session, loads the streamer's access config, then
 * queries Stellar Horizon for the viewer's token balance.
 *
 * Body: { streamerUsername: string }
 *
 * Response:
 *   { allowed: true }
 *   { allowed: false, reason: "token_gated" | "no_wallet" | "public" }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  checkTokenGatedAccess,
} from "@/lib/stream/access";
import type { StreamAccessType, TokenGateConfig } from "@/types/stream-access";

export async function POST(req: NextRequest) {
  let body: { streamerUsername?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { streamerUsername } = body;
  if (!streamerUsername || typeof streamerUsername !== "string") {
    return NextResponse.json(
      { error: "streamerUsername is required" },
      { status: 400 }
    );
  }

  // Resolve viewer wallet from their session (server-trusted)
  const session = await verifySession(req);
  const viewerWallet = session.ok ? session.wallet : null;

  // Load streamer's access settings
  type StreamerRow = {
    id: string;
    stream_access_type: StreamAccessType;
    stream_access_config: TokenGateConfig | null;
  };
  let streamer: StreamerRow;

  try {
    const result = await sql`
      SELECT id, stream_access_type, stream_access_config
      FROM users
      WHERE username = ${streamerUsername}
      LIMIT 1
    `;
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Streamer not found" }, { status: 404 });
    }
    streamer = result.rows[0] as unknown as StreamerRow;
  } catch (err) {
    console.error("[access/check] DB error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Public stream — always allowed
  if (!streamer.stream_access_type || streamer.stream_access_type === "public") {
    return NextResponse.json({ allowed: true, reason: "public" });
  }

  // Token-gated stream
  if (streamer.stream_access_type === "token_gated") {
    if (!streamer.stream_access_config) {
      // Misconfigured — fail open to avoid locking out everyone
      console.warn(
        `[access/check] token_gated stream for ${streamerUsername} has no config — allowing`
      );
      return NextResponse.json({ allowed: true });
    }

    const accessResult = await checkTokenGatedAccess(
      streamer.stream_access_config,
      viewerWallet,
      streamer.id
    );
    return NextResponse.json(accessResult);
  }

  return NextResponse.json({ allowed: true });
}
