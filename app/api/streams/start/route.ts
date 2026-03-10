import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getMuxStreamHealth } from "@/lib/mux/server";
import { verifySession } from "@/lib/auth/verify-session";
import { writeNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  // Verify the caller is logged in
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    const userResult = await sql`
      SELECT id, username, mux_stream_id, is_live, mux_playback_id
      FROM users
      WHERE id = ${session.userId} AND mux_stream_id IS NOT NULL
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
      const streamHealth = await getMuxStreamHealth(user.mux_stream_id);
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
      RETURNING id, username, mux_stream_id, mux_playback_id
    `;

    const updatedUser = result.rows[0];

    try {
      await sql`
        INSERT INTO stream_sessions (user_id, mux_session_id, playback_id, started_at)
        VALUES (${updatedUser.id}, ${updatedUser.mux_stream_id}, ${updatedUser.mux_playback_id}, CURRENT_TIMESTAMP)
      `;
    } catch (sessionError) {
      console.error("Failed to create stream session record:", sessionError);
    }

    // Fire-and-forget live notifications to all followers via join table
    sql`SELECT follower_id FROM user_follows WHERE followee_id = ${updatedUser.id}`
      .then(({ rows }) => {
        for (const { follower_id } of rows) {
          writeNotification(
            follower_id,
            "live",
            `${updatedUser.username} is live!`,
            `${updatedUser.username} just started streaming`
          ).catch(() => {});
        }
      })
      .catch(() => {});

    return NextResponse.json(
      {
        message: "Stream started successfully",
        streamData: {
          isLive: true,
          streamId: updatedUser.mux_stream_id,
          playbackId: updatedUser.mux_playback_id,
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

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    const userResult = await sql`
      SELECT id, mux_stream_id, is_live
      FROM users
      WHERE id = ${session.userId}
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
