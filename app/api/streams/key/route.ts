import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getWalletOrDevDefault } from "@/lib/dev-mode";

/**
 * GET /api/streams/key
 * Retrieves a user's persistent stream key for dashboard/settings.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let wallet = searchParams.get("wallet");

    // DEV MODE: fallback to test wallet if not provided
    wallet = getWalletOrDevDefault(wallet);

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter is required" },
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
        enable_recording
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (!user.streamkey || !user.mux_stream_id) {
      console.log(`[routes-f] No persistent stream found for wallet: ${wallet}`);
      return NextResponse.json(
        {
          message: "No stream key found",
          hasStream: false,
          streamKey: null,
          enableRecording: !!user.enable_recording,
        },
        { status: 200 }
      );
    }

    console.log(`[routes-f] Retrieved persistent stream key for wallet: ${wallet}`);

    return NextResponse.json(
      {
        message: "Stream key retrieved successfully",
        hasStream: true,
        streamData: {
          streamKey: user.streamkey,
          streamId: user.mux_stream_id,
          playbackId: user.mux_playback_id,
          rtmpUrl: "rtmp://global-live.mux.com:5222/app",
          isLive: !!user.is_live,
          enableRecording: !!user.enable_recording,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f] Stream key retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve stream key" },
      { status: 500 }
    );
  }
}