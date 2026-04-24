import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * GET /api/streams/recordings/[wallet]
 * List recordings (VODs) for the user identified by wallet.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    if (!wallet) {
      console.warn("[routes-f] Recordings request missing wallet");
      return NextResponse.json(
        { success: false, error: "Wallet required" },
        { status: 400 }
      );
    }

    console.log(`[routes-f] Fetching recordings for wallet: ${wallet}`);

    const result = await sql`
      SELECT
        r.id,
        r.mux_asset_id,
        r.playback_id,
        r.title,
        r.duration,
        r.created_at,
        r.status,
        ss.started_at AS stream_date
      FROM stream_recordings r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
      WHERE LOWER(u.wallet) = LOWER(${wallet})
      ORDER BY r.created_at DESC
    `;

    const recordings = result.rows.map(r => ({
      id: r.id,
      muxAssetId: r.mux_asset_id,
      playbackId: r.playback_id,
      title: r.title,
      duration: r.duration, // optionally format into mm:ss
      status: r.status,
      createdAt: r.created_at,
      streamDate: r.stream_date,
    }));

    console.log(`[routes-f] Found ${recordings.length} recordings for ${wallet}`);

    return NextResponse.json({
      success: true,
      recordings,
    });
  } catch (error) {
    console.error("[routes-f] Error fetching recordings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}