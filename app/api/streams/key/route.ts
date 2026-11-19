import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getWalletOrDevDefault, shouldBypassAuth } from "@/lib/dev-mode";
import { verifySession } from "@/lib/auth/verify-session";

/**
 * GET /api/streams/key
 * Get the caller's own persistent stream key for the settings page.
 *
 * The stream key is a broadcast credential (RTMP hijack risk) — identity
 * comes from the verified session, never from a client-supplied wallet.
 */
export async function GET(req: NextRequest) {
  try {
    let wallet: string;

    if (shouldBypassAuth()) {
      // DEV MODE: Use test wallet if no wallet provided
      wallet = getWalletOrDevDefault(
        new URL(req.url).searchParams.get("wallet")
      );
    } else {
      const session = await verifySession(req);
      if (!session.ok) {
        return session.response;
      }
      if (!session.wallet) {
        return NextResponse.json(
          { error: "No wallet on session" },
          { status: 400 }
        );
      }
      wallet = session.wallet;
    }

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter required" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT
        id,
        username,
        streamkey,
        mux_stream_id,
        mux_playback_id,
        is_live,
        enable_recording,
        latency_mode,
        stream_access_type,
        creator
      FROM users
      WHERE wallet = ${wallet} AND deleted_at IS NULL
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.streamkey || !user.mux_stream_id) {
      return NextResponse.json(
        {
          message: "No stream key found",
          hasStream: false,
          streamKey: null,
          enableRecording: user.enable_recording === true,
          latencyMode: user.latency_mode || "low",
          streamAccessType: user.stream_access_type || "public",
          subscriptionPriceUsdc:
            Number(
              user.creator?.subscriptionPrice ??
                user.creator?.subscription_price_usdc
            ) || null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: "Stream key retrieved successfully",
        hasStream: true,
        streamData: {
          streamKey: user.streamkey,
          streamId: user.mux_stream_id,
          playbackId: user.mux_playback_id,
          rtmpUrl: "rtmp://global-live.mux.com:5222/app",
          isLive: user.is_live || false,
          enableRecording: user.enable_recording === true,
          latencyMode: user.latency_mode || "low",
          streamAccessType: user.stream_access_type || "public",
          subscriptionPriceUsdc:
            Number(
              user.creator?.subscriptionPrice ??
                user.creator?.subscription_price_usdc
            ) || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stream key retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve stream key" },
      { status: 500 }
    );
  }
}
