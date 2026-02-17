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
        is_live
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
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
