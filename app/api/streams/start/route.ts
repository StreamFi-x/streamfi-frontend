import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getMuxStreamHealth } from "@/lib/mux/server";
import { verifySession } from "@/lib/auth/verify-session";
import {
  createLiveNotificationsForFollowers,
  withNotificationTransaction,
} from "@/lib/notifications";

export async function POST(req: NextRequest) {
  // Verify the caller is logged in
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

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

    const updatedUser = await withNotificationTransaction(async client => {
      const result = await client.sql<{
        id: string;
        username: string;
        mux_stream_id: string;
        mux_playback_id: string | null;
        stream_started_at: Date;
      }>`
        UPDATE users SET
          is_live = true,
          stream_started_at = CURRENT_TIMESTAMP,
          current_viewers = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id} AND is_live = false
        RETURNING id, username, mux_stream_id, mux_playback_id, stream_started_at
      `;

      const updated = result.rows[0];
      if (!updated) {
        throw new Error("Stream is already live");
      }

      await client.sql`
        INSERT INTO stream_sessions (user_id, mux_session_id, playback_id, started_at)
        SELECT ${updated.id}, ${updated.mux_stream_id}, ${updated.mux_playback_id}, ${updated.stream_started_at.toISOString()}
        WHERE NOT EXISTS (
          SELECT 1 FROM stream_sessions WHERE user_id = ${updated.id} AND ended_at IS NULL
        )
      `;

      await createLiveNotificationsForFollowers({
        creatorId: updated.id,
        creatorUsername: updated.username,
        playbackId: updated.mux_playback_id,
        dedupeKey: `stream-live:${updated.id}:${updated.stream_started_at.toISOString()}`,
        client,
      });

      return updated;
    });

    // Activity event — non-blocking
    try {
      await sql`
        INSERT INTO route_f_activity_events (user_id, type, metadata)
        VALUES (
          ${updatedUser.id},
          'stream_started',
          ${JSON.stringify({
            stream_id: updatedUser.mux_stream_id,
            playback_id: updatedUser.mux_playback_id,
          })}::jsonb
        )
      `;
    } catch (activityErr) {
      console.error("[stream start] activity insert error:", activityErr);
    }

    return NextResponse.json(
      {
        message: "Stream started successfully",
        streamData: {
          isLive: true,
          streamId: updatedUser.mux_stream_id,
          playbackId: updatedUser.mux_playback_id,
          username: updatedUser.username,
          startedAt: updatedUser.stream_started_at.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stream start error:", error);
    if (error instanceof Error && error.message === "Stream is already live") {
      return NextResponse.json(
        { error: "Stream is already live" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to start stream" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

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

    // Activity event — non-blocking
    try {
      // Retrieve the just-ended session for duration and peak viewers
      const { rows: sessionRows } = await sql`
        SELECT duration_seconds, peak_viewers
        FROM stream_sessions
        WHERE user_id = ${user.id}
        ORDER BY ended_at DESC NULLS LAST
        LIMIT 1
      `;
      const sess = sessionRows[0];
      await sql`
        INSERT INTO route_f_activity_events (user_id, type, metadata)
        VALUES (
          ${user.id},
          'stream_ended',
          ${JSON.stringify({
            duration_s: sess?.duration_seconds ?? 0,
            peak_viewers: sess?.peak_viewers ?? 0,
          })}::jsonb
        )
      `;
    } catch (activityErr) {
      console.error("[stream stop] activity insert error:", activityErr);
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
