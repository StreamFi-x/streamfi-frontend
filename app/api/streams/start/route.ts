import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getStreamHealth } from "@/lib/livepeer/server";

export async function POST(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet is required" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT id, username, livepeer_stream_id, is_live 
      FROM users 
      WHERE wallet = ${wallet} AND livepeer_stream_id IS NOT NULL
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found or stream not configured" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (user.is_live) {
      return NextResponse.json(
        { error: "Stream is already live" },
        { status: 409 }
      );
    }

    try {
      const streamHealth = await getStreamHealth(user.livepeer_stream_id);
      if (!streamHealth) {
        return NextResponse.json(
          { error: "Stream service unavailable" },
          { status: 503 }
        );
      }
    } catch (healthError) {
      console.error("Stream health check failed:", healthError);
    }

    const result = await sql`
      UPDATE users SET
        is_live = true,
        stream_started_at = CURRENT_TIMESTAMP,
        current_viewers = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
      RETURNING id, username, livepeer_stream_id, playback_id
    `;

    const updatedUser = result.rows[0];

    try {
      await sql`
        INSERT INTO stream_sessions (user_id, livepeer_session_id, started_at)
        VALUES (${updatedUser.id}, ${updatedUser.livepeer_stream_id}, CURRENT_TIMESTAMP)
      `;
    } catch (sessionError) {
      console.error("Failed to create stream session record:", sessionError);
    }

    return NextResponse.json(
      {
        message: "Stream started successfully",
        streamData: {
          isLive: true,
          streamId: updatedUser.livepeer_stream_id,
          playbackId: updatedUser.playback_id,
          username: updatedUser.username,
          startedAt: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stream start error:", error);
    return NextResponse.json(
      { error: "Failed to start stream" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet is required" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT id, livepeer_stream_id, is_live 
      FROM users 
      WHERE wallet = ${wallet}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.is_live) {
      return NextResponse.json(
        { error: "Stream is not currently live" },
        { status: 409 }
      );
    }

    await sql`
      UPDATE users SET
        is_live = false,
        stream_started_at = NULL,
        current_viewers = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;

    try {
      await sql`
        UPDATE stream_sessions SET
          ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user.id} AND ended_at IS NULL
      `;
    } catch (sessionError) {
      console.error("Failed to end stream session:", sessionError);
    }

    return NextResponse.json(
      { message: "Stream stopped successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stream stop error:", error);
    return NextResponse.json(
      { error: "Failed to stop stream" },
      { status: 500 }
    );
  }
}
