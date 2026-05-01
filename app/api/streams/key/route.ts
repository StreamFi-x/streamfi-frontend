import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getWalletOrDevDefault } from "@/lib/dev-mode";

/**
 * GET /api/streams/key
 * Get user's persistent stream key for settings page
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let wallet = searchParams.get("wallet");

    // DEV MODE: Use test wallet if no wallet provided
    wallet = getWalletOrDevDefault(wallet);

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
        stream_privacy,
        mux_stream_provisioned_with_dvr,
        mux_stream_provisioned_with_signed_playback
      FROM users
      WHERE wallet = ${wallet}
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
        },
        { status: 200 }
      );
    }

    const latencyMode = user.latency_mode || "low";
    const privacy = user.stream_privacy || "public";
    const provisionedDvr = user.mux_stream_provisioned_with_dvr === true;
    const provisionedSigned =
      user.mux_stream_provisioned_with_signed_playback === true;

    // Detect mismatches between saved settings and what the live Mux stream
    // was actually provisioned with — surfaces "Apply now" prompt in UI.
    const outOfSync: string[] = [];
    if (latencyMode === "standard" && !provisionedDvr) {
      outOfSync.push("dvr");
    }
    if (privacy !== "public" && !provisionedSigned) {
      outOfSync.push("signed_playback");
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
          latencyMode,
          privacy,
          provisionedWithDvr: provisionedDvr,
          provisionedWithSignedPlayback: provisionedSigned,
          outOfSync,
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
