import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter required" },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT 
        id,
        username,
        wallet,
        livepeer_stream_id,
        playback_id,
        streamkey,
        is_live,
        creator
      FROM users 
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        wallet: user.wallet,
        hasLivepeerStream: !!user.livepeer_stream_id,
        livepeerStreamId: user.livepeer_stream_id,
        playbackId: user.playback_id,
        streamKey: user.streamkey ? "***HIDDEN***" : null,
        isLive: user.is_live,
        streamTitle: user.creator?.streamTitle || null,
      },
      canCreateStream: !user.livepeer_stream_id,
      message: user.livepeer_stream_id
        ? "User already has a stream - delete it first before creating new one"
        : "User can create a new stream",
    });
  } catch (error) {
    console.error("User stream check error:", error);
    return NextResponse.json(
      {
        error: "Failed to check user stream status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
