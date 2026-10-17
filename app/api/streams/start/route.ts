import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getMuxStreamHealth } from "@/lib/mux/server";
import { verifySession } from "@/lib/auth/verify-session";
import { markRecentWrite } from "@/lib/db/replica";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { syncScheduleLiveStatusForCreator } from "@/lib/routes-f/schedule";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { dispatchJob } from "@/lib/jobs/qstash";
import { liveFanoutJob } from "@/lib/jobs/definitions/live-fanout";

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
      WHERE id = ${session.userId} AND mux_stream_id IS NOT NULL AND deleted_at IS NULL
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
    await invalidateUserCaches({ id: user.id });

    const updatedUser = result.rows[0];

    let streamSessionId: string | null = null;
    try {
      const sessionResult = await sql`
        INSERT INTO stream_sessions (user_id, mux_session_id, playback_id, started_at)
        VALUES (${updatedUser.id}, ${updatedUser.mux_stream_id}, ${updatedUser.mux_playback_id}, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      streamSessionId = (sessionResult.rows[0]?.id as string) ?? null;
      await sql`DELETE FROM stream_password_attempts WHERE updated_at < now() - interval '1 day' OR stream_session_id IN (SELECT id FROM stream_sessions WHERE ended_at IS NOT NULL AND ended_at < now() - interval '1 day')`;
      await syncScheduleLiveStatusForCreator(String(updatedUser.id));
    } catch (sessionError) {
      console.error("Failed to create stream session record:", sessionError);
    }

    // Enqueue the async fan-out of "go live" notifications to followers (#1138).
    // Fire-and-forget: a single QStash publish that never blocks the response.
    // The job pages through the follower graph in batches, respects per-follower
    // notification preferences, and is idempotent per (creator, stream-session).
    dispatchJob(
      liveFanoutJob,
      { creatorId: updatedUser.id, streamSessionId },
      {
        deduplicationId: `live-fanout:${updatedUser.id}:${streamSessionId ?? "nosession"}`,
      }
    )
      .then(result => {
        if (!result.dispatched) {
          console.warn(
            `[stream-start] live-fanout not dispatched (${result.reason})`
          );
        }
      })
      .catch(err => {
        console.error("[stream-start] live-fanout dispatch error:", err);
      });

    return markRecentWrite(
      NextResponse.json(
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
      )
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
  if (!session.ok) {
    return session.response;
  }

  try {
    const userResult = await sql`
      SELECT id, mux_stream_id, is_live
      FROM users
      WHERE id = ${session.userId} AND deleted_at IS NULL
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
    await invalidateUserCaches({ id: user.id });

    try {
      await sql`
        UPDATE stream_sessions SET
          ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user.id} AND ended_at IS NULL
      `;
      await evaluateAndAwardBadges(String(user.id));
    } catch (sessionError) {
      console.error("Failed to end stream session:", sessionError);
    }

    return markRecentWrite(
      NextResponse.json(
        { message: "Stream stopped successfully" },
        { status: 200 }
      )
    );
  } catch (error) {
    console.error("Stream stop error:", error);
    return NextResponse.json(
      { error: "Failed to stop stream" },
      { status: 500 }
    );
  }
}
