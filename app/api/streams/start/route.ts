import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { getMuxStreamHealth } from "@/lib/mux/server";
import { verifySession } from "@/lib/auth/verify-session";
import { markRecentWrite } from "@/lib/db/replica";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { syncScheduleLiveStatusForCreator } from "@/lib/routes-f/schedule";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { dispatchJob } from "@/lib/jobs/qstash";
import { liveFanoutJob } from "@/lib/jobs/definitions/live-fanout";
import {
  apiConflict,
  apiInternalError,
  apiNotFound,
  apiServiceUnavailable,
  apiSuccess,
} from "@/lib/api";

export async function POST(req: NextRequest) {
  // Verify the caller is logged in
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    let requestedLatencyMode: string | undefined;
    try {
      const body = await req.json();
      requestedLatencyMode = body.latencyMode;
    } catch {
      // No body or invalid JSON, that's fine - will use user default
    }
    const userResult = await sql`
      SELECT id, username, mux_stream_id, is_live, mux_playback_id, latency_mode
      FROM users
      WHERE id = ${session.userId} AND mux_stream_id IS NOT NULL AND deleted_at IS NULL
    `;

    if (userResult.rows.length === 0) {
      return apiNotFound("User not found or stream not configured");
    }

    const user = userResult.rows[0];

    if (user.is_live) {
      return apiConflict("Stream is already live");
    }

    try {
      const streamHealth = await getMuxStreamHealth(user.mux_stream_id);
      if (!streamHealth) {
        return apiServiceUnavailable("Stream service unavailable");
      }
    } catch (healthError) {
      // eslint-disable-next-line no-console
      console.error("Stream health check failed:", healthError);
    }

    // Conditional on is_live = false so a Mux "live_stream.active" webhook that
    // marks the creator live between the SELECT above and this UPDATE loses the
    // race: this UPDATE affects 0 rows and we bail with 409 instead of creating
    // a duplicate stream session and a second fan-out dispatch. The webhook's
    // own afterCommit dispatch then covers this go-live (#1138).
    const result = await sql`
      UPDATE users SET
        is_live = true,
        stream_started_at = CURRENT_TIMESTAMP,
        current_viewers = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id} AND is_live = false
      RETURNING id, username, mux_stream_id, mux_playback_id
    `;

    if (result.rows.length === 0) {
      return apiConflict("Stream is already live");
    }

    await invalidateUserCaches({ id: user.id });

    const updatedUser = result.rows[0];

    let streamSessionId: string | null = null;
    try {
      // Use requested latency mode if valid, otherwise fall back to user's global preference
      const effectiveLatencyMode = (
        requestedLatencyMode === "standard" || requestedLatencyMode === "low"
          ? requestedLatencyMode
          : user.latency_mode === "standard"
            ? "standard"
            : "low"
      ) as "low" | "standard";

      const sessionResult = await sql`
        INSERT INTO stream_sessions (user_id, mux_session_id, playback_id, started_at, latency_mode)
        VALUES (${updatedUser.id}, ${updatedUser.mux_stream_id}, ${updatedUser.mux_playback_id}, CURRENT_TIMESTAMP, ${effectiveLatencyMode})
        RETURNING id
      `;
      streamSessionId = (sessionResult?.rows?.[0]?.id as string) ?? null;
      await sql`DELETE FROM stream_password_attempts WHERE updated_at < now() - interval '1 day' OR stream_session_id IN (SELECT id FROM stream_sessions WHERE ended_at IS NOT NULL AND ended_at < now() - interval '1 day')`;
      await syncScheduleLiveStatusForCreator(String(updatedUser.id));
    } catch (sessionError) {
      // eslint-disable-next-line no-console
      console.error("Failed to create stream session record:", sessionError);
    }

    // Enqueue the async fan-out of "go live" notifications to followers (#1138).
    try {
      const dispatchResult = await dispatchJob(
        liveFanoutJob,
        { creatorId: updatedUser.id, streamSessionId },
        {
          deduplicationId: `live-fanout:${updatedUser.id}:${new Date().toISOString().slice(0, 10)}`,
        }
      );
      if (!dispatchResult.dispatched) {
        // eslint-disable-next-line no-console
        console.warn(
          `[stream-start] live-fanout not dispatched (${dispatchResult.reason})`
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[stream-start] live-fanout dispatch error:", err);
    }

    return markRecentWrite(
      apiSuccess(
        {
          streamData: {
            isLive: true,
            streamId: updatedUser.mux_stream_id,
            playbackId: updatedUser.mux_playback_id,
            username: updatedUser.username,
            startedAt: new Date().toISOString(),
          },
        },
        { message: "Stream started successfully", legacyFlat: true }
      )
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Stream start error:", error);
    return apiInternalError("Failed to start stream");
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
      return apiNotFound("User not found");
    }

    const user = userResult.rows[0];

    if (!user.is_live) {
      return apiConflict("Stream is not currently live");
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
      // eslint-disable-next-line no-console
      console.error("Failed to end stream session:", sessionError);
    }

    return markRecentWrite(
      apiSuccess(
        { stopped: true },
        { message: "Stream stopped successfully", legacyFlat: true }
      )
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Stream stop error:", error);
    return apiInternalError("Failed to stop stream");
  }
}
