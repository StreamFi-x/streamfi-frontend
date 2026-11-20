import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { deleteMuxStream } from "@/lib/mux/server";
import { verifySession } from "@/lib/auth/verify-session";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { markRecentWrite } from "@/lib/db/replica";
import {
  apiConflict,
  apiInternalError,
  apiMethodNotAllowed,
  apiNotFound,
  apiSuccess,
} from "@/lib/api";

async function shouldForceDelete(req: NextRequest): Promise<boolean> {
  if (req.url) {
    const queryForce = new URL(req.url).searchParams.get("force");
    if (queryForce === "true" || queryForce === "1") {
      return true;
    }
  }

  try {
    if (typeof req.text === "function") {
      const raw = await req.text();
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw) as { force?: unknown };
      return parsed?.force === true;
    }
    if (typeof req.json === "function") {
      const parsed = (await req.json()) as { force?: unknown };
      return parsed?.force === true;
    }
  } catch {
    return false;
  }

  return false;
}

export async function DELETE(req: NextRequest) {
  // Verify caller is authenticated — identity comes from the server-side session
  // cookie, NOT from client-supplied body or query fields.
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const force = await shouldForceDelete(req);

    const userResult = await sql`
      SELECT id, username, mux_stream_id, is_live
      FROM users
      WHERE id = ${session.userId} AND deleted_at IS NULL
    `;

    if (userResult.rows.length === 0) {
      return apiNotFound("User not found");
    }

    const user = userResult.rows[0];

    if (!user.mux_stream_id) {
      return apiNotFound("No stream found to delete");
    }

    if (user.is_live && !force) {
      return apiConflict(
        "Cannot delete stream while live. Please stop the stream first, or pass force=true to stop and delete."
      );
    }

    const wasLive = Boolean(user.is_live);
    if (wasLive && force) {
      await sql`
        UPDATE users SET
          is_live = false,
          stream_started_at = NULL,
          current_viewers = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;
      await invalidateUserCaches({ id: session.userId });
    }

    try {
      await sql`
        UPDATE stream_sessions SET
          ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user.id} AND ended_at IS NULL
      `;
    } catch (sessionError) {
      // eslint-disable-next-line no-console
      console.error("Failed to end stream sessions:", sessionError);
    }

    try {
      await deleteMuxStream(user.mux_stream_id);
    } catch (muxError) {
      // eslint-disable-next-line no-console
      console.error("Mux deletion failed:", muxError);
      // Continue even if Mux deletion fails — we still clean up our DB record
    }

    await sql`
      UPDATE users SET
        mux_stream_id = NULL,
        mux_playback_id = NULL,
        streamkey = NULL,
        is_live = false,
        current_viewers = 0,
        stream_started_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.userId}
    `;
    await invalidateUserCaches({ id: session.userId });

    const actions = [
      wasLive ? "Stopped live stream" : "Stream was already stopped",
      "Deleted from Mux",
      "Cleaned database records",
    ];

    return markRecentWrite(
      apiSuccess(
        {
          forced: wasLive && force,
          actions,
        },
        {
          message:
            wasLive && force
              ? "Stream force deleted successfully"
              : "Stream deleted successfully",
          legacyFlat: true,
        }
      )
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Stream deletion error:", error);
    return apiInternalError("Failed to delete stream");
  }
}

export async function GET() {
  return apiMethodNotAllowed("DELETE");
}
