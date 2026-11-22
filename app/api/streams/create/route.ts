import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createMuxStream, deleteMuxStream } from "@/lib/mux/server";
import { checkExistingTableDetail } from "@/utils/validators";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  JsonbContractError,
  isMergeableCreator,
  prepareCreatorPatch,
} from "@/lib/db/jsonb-contracts";
import { createSanitizedErrorResponse } from '@/lib/api/error-response';
import { invalidateUserCaches } from '@/lib/cache/invalidation';
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";
import {
  apiBadRequest,
  apiConflict,
  apiCreated,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiServiceUnavailable,
  apiSuccess,
  apiValidationError,
} from "@/lib/api";

// Stream creation calls Mux API + DB — limit per IP to prevent quota exhaustion
const isRateLimited = createRateLimiter(60 * 60 * 1000, 10); // 10 per hour per IP

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return apiRateLimited("Too many requests", { retryAfterSeconds: 3600 });
  }
  try {
    const body = await req.json();
    const { title, description, category, tags, latencyMode } = body;

    // A stream is provisioned for the CALLER, never for an arbitrary
    // body-supplied wallet — otherwise anyone can trigger Mux stream
    // creation (real cost) on a victim's behalf, or read back their
    // existing stream key.
    let wallet: string | undefined = body.wallet;
    if (!shouldBypassAuth()) {
      const session = await verifySession(req);
      if (!session.ok) {
        return session.response;
      }
      if (!session.wallet) {
        return apiBadRequest("No wallet on session");
      }
      wallet = session.wallet;
    }

    if (!wallet || !title) {
      return apiBadRequest("Wallet and title are required");
    }

    if (title.length > 100) {
      return apiBadRequest("Title must be 100 characters or less");
    }

    if (description && description.length > 500) {
      return apiBadRequest("Description must be 500 characters or less");
    }

    const userExists = await checkExistingTableDetail(
      "users",
      "wallet",
      wallet
    );
    if (!userExists) {
      return apiNotFound("User not found");
    }

    const userResult = await sql`
      SELECT id, username, creator, mux_stream_id, enable_recording, latency_mode FROM users WHERE LOWER(wallet) = LOWER(${wallet}) AND deleted_at IS NULL
    `;

    if (userResult.rows.length === 0) {
      return apiNotFound("User not found");
    }

    const user = userResult.rows[0];

    // PERSISTENT STREAM KEY FLOW: If user already has a stream, return it
    if (user.mux_stream_id) {
      const streamDataResult = await sql`
        SELECT mux_stream_id, mux_playback_id, streamkey, is_live
        FROM users
        WHERE id = ${user.id} AND deleted_at IS NULL
      `;

      const streamData = streamDataResult.rows[0];

      return apiSuccess(
        {
          streamData: {
            streamId: streamData.mux_stream_id,
            playbackId: streamData.mux_playback_id,
            streamKey: streamData.streamkey,
            rtmpUrl: "rtmp://global-live.mux.com:5222/app",
            title: title,
            isActive: streamData.is_live || false,
            persistent: true,
          },
        },
        { message: "Stream already exists", legacyFlat: true }
      );
    }

    // Validate the creator patch before creating anything in Mux.
    let creatorPatch: ReturnType<typeof prepareCreatorPatch>;
    try {
      creatorPatch = prepareCreatorPatch({
        streamTitle: title,
        description: description || "",
        category: category || "",
        tags: tags || [],
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof JsonbContractError) {
        return apiValidationError("Invalid stream details", error.issues, {
          legacyExtra: { issues: error.issues },
        });
      }
      throw error;
    }
    if (!isMergeableCreator(user.creator)) {
      // eslint-disable-next-line no-console
      console.error(
        `[streams/create] stored creator for user ${user.id} is malformed; run the JSONB audit`
      );
      return apiConflict("Stored stream details are malformed");
    }

    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
      return apiInternalError("Mux credentials not configured");
    }

    const enableRecording = user.enable_recording === true;
    // Use provided per-stream latency mode, fall back to user's global preference
    const effectiveLatencyMode = (
      latencyMode === "standard" || latencyMode === "low"
        ? latencyMode
        : user.latency_mode === "standard"
          ? "standard"
          : "low"
    ) as "low" | "standard";

    let muxStream;
    try {
      muxStream = await createMuxStream({
        name: `${user.username} - ${title}`,
        record: enableRecording,
        latencyMode: effectiveLatencyMode,
      });
    } catch (muxError) {
      // eslint-disable-next-line no-console
      console.error("Mux stream creation failed:", muxError);

      if (muxError instanceof Error) {
        console.error("Mux error details:", {
          message: muxError.message,
          stack: muxError.stack,
          name: muxError.name,
        });
      }

      return apiInternalError("Failed to create stream. Please try again later.");
    }

    if (
      !muxStream ||
      !muxStream.id ||
      !muxStream.playbackId ||
      !muxStream.streamKey
    ) {
      return apiInternalError(
        "Failed to create Mux stream - incomplete response"
      );
    }

    try {
      await sql`
        UPDATE users SET
          mux_stream_id = ${muxStream.id},
          mux_playback_id = ${muxStream.playbackId},
          streamkey = ${muxStream.streamKey},
          creator = COALESCE(creator, '{}'::jsonb) || ${JSON.stringify(creatorPatch)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE wallet = ${wallet}
      `;
      await invalidateUserCaches({ wallet });
    } catch (dbError) {
      // eslint-disable-next-line no-console
      console.error("Database update failed:", dbError);

      try {
        await deleteMuxStream(muxStream.id);
      } catch (cleanupError) {
        // eslint-disable-next-line no-console
        console.error("Cleanup failed:", cleanupError);
      }

      return apiInternalError("Failed to create stream. Please try again later.");
    }

    return apiCreated(
      {
        streamData: {
          streamId: muxStream.id,
          playbackId: muxStream.playbackId,
          streamKey: muxStream.streamKey,
          rtmpUrl: muxStream.rtmpUrl,
          title: title,
          isActive: muxStream.isActive || false,
        },
      },
      { message: "Stream created successfully", legacyFlat: true }
    );
  } catch (error) {
    console.error("❌ Stream creation error:", error);
    if (error instanceof Error) {
      if (error.message.includes("Mux")) {
        return apiServiceUnavailable(
          "Streaming service unavailable. Please try again later."
        );
      }
      if (error.message.includes("database") || error.message.includes("sql")) {
        return apiServiceUnavailable("Service temporarily unavailable. Please try again later.");
      }
    }

    return createSanitizedErrorResponse(error, {
      context: 'streams/create POST',
      publicMessage: 'Failed to create stream',
    });
  }
}
