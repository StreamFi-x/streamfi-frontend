import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getMuxStreamHealth } from "@/lib/mux/server";

export async function POST(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json({ error: "Wallet is required" }, { status: 400 });
    }

    console.log("[routes-f] Start stream request for wallet:", wallet);

    const userResult = await sql`
      SELECT id, username, mux_stream_id, mux_playback_id, is_live
      FROM users
      WHERE wallet = ${wallet} AND mux_stream_id IS NOT NULL
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found or stream not configured" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (user.is_live) {
      return NextResponse.json({ error: "Stream is already live" }, { status: 409 });
    }

    try {
      const health = await getMuxStreamHealth(user.mux_stream_id);
      if (!health) {
        return NextResponse.json({ error: "Stream service unavailable" }, { status: 503 });
      }
    } catch (err) {
      console.error("[routes-f] Stream health check failed:", err);
    }

    // Start stream and record timestamp from DB
    const result = await sql`
      UPDATE users SET
        is_live = true,
        stream_started_at = CURRENT_TIMESTAMP,
        current_viewers = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
      RETURNING id, username, mux_stream_id, mux_playback_id, stream_started_at
    `;

    const updatedUser = result.rows[0];

    try {
      await sql`
        INSERT INTO stream_sessions (user_id, mux_session_id, playback_id, started_at)
        VALUES (${updatedUser.id}, ${updatedUser.mux_stream_id}, ${updatedUser.mux_playback_id}, ${updatedUser.stream_started_at})
      `;
    } catch (sessionError) {
      console.error("[routes-f] Failed to create stream session:", sessionError, "wallet:", wallet);
    }

    return NextResponse.json({
      message: "Stream started successfully",
      streamData: {
        isLive: true,
        streamId: updatedUser.mux_stream_id,
        playbackId: updatedUser.mux_playback_id,
        username: updatedUser.username,
        startedAt: updatedUser.stream_started_at,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("[routes-f] Stream start error:", error);
    return NextResponse.json({ error: "Failed to start stream" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { wallet } = await req.json();
    if (!wallet) {
      return NextResponse.json({ error: "Wallet is required" }, { status: 400 });
    }

    console.log("[routes-f] Stop stream request for wallet:", wallet);

    const userResult = await sql`
      SELECT id, mux_stream_id, is_live
      FROM users
      WHERE wallet = ${wallet}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.is_live) {
      return NextResponse.json({ error: "Stream is not currently live" }, { status: 409 });
    }

    const result = await sql`
      UPDATE users SET
        is_live = false,
        stream_started_at = NULL,
        current_viewers = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
      RETURNING stream_started_at
    `;

    const stoppedAt = new Date().toISOString();

    try {
      await sql`
        UPDATE stream_sessions SET
          ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user.id} AND ended_at IS NULL
      `;
    } catch (sessionError) {
      console.error("[routes-f] Failed to end stream session:", sessionError, "wallet:", wallet);
    }

    return NextResponse.json({
      message: "Stream stopped successfully",
      endedAt: stoppedAt,
    }, { status: 200 });
  } catch (error) {
    console.error("[routes-f] Stream stop error:", error);
    return NextResponse.json({ error: "Failed to stop stream" }, { status: 500 });
  }
}