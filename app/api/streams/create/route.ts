import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createMuxStream } from "@/lib/mux/server";
import { checkExistingTableDetail } from "@/utils/validators";
import { routesFSuccess, routesFError } from "../../routesF/response";

export async function POST(req: Request) {
  try {
    const { wallet, title, description, category, tags } = await req.json();

    console.log("🔍 Stream creation request:", { wallet, title, description, category, tags });

    // Validation
    if (!wallet || !title) {
      return routesFError("Wallet and title are required", 400);
    }
    if (title.length > 100) {
      return routesFError("Title must be 100 characters or less", 400);
    }
    if (description && description.length > 500) {
      return routesFError("Description must be 500 characters or less", 400);
    }

    // Check user existence
    const userExists = await checkExistingTableDetail("users", "wallet", wallet);
    if (!userExists) return routesFError("User not found", 404);

    const userResult = await sql`
      SELECT id, username, creator, mux_stream_id, enable_recording, is_live
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;
    if (userResult.rows.length === 0) return routesFError("User not found", 404);

    const user = userResult.rows[0];

    // Persistent stream: return if already exists
    if (user.mux_stream_id) {
      const streamDataResult = await sql`
        SELECT mux_stream_id, mux_playback_id, streamkey, is_live
        FROM users WHERE id = ${user.id}
      `;
      const streamData = streamDataResult.rows[0];
      return routesFSuccess(
        {
          message: "Stream already exists",
          streamData: {
            streamId: streamData.mux_stream_id,
            playbackId: streamData.mux_playback_id,
            streamKey: streamData.streamkey,
            rtmpUrl: "rtmp://global-live.mux.com:5222/app",
            title,
            isActive: streamData.is_live || false,
            persistent: true,
          },
        },
        200
      );
    }

    // Mux credentials
    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
      return routesFError("Mux credentials not configured", 500);
    }

    // Create Mux stream
    let muxStream;
    try {
      muxStream = await createMuxStream({
        name: `${user.username} - ${title}`,
        record: user.enable_recording === true,
      });
    } catch (muxError) {
      console.error("Mux creation failed:", muxError);
      return routesFError(
        "Streaming service unavailable. Please try again later.",
        503
      );
    }

    if (!muxStream?.id || !muxStream.playbackId || !muxStream.streamKey) {
      return routesFError("Failed to create Mux stream - incomplete response", 500);
    }

    // Update user record
    const updatedCreator = {
      ...user.creator,
      streamTitle: title,
      description: description || "",
      category: category || "",
      tags: tags || [],
      lastUpdated: new Date().toISOString(),
    };

    try {
      await sql`
        UPDATE users SET
          mux_stream_id = ${muxStream.id},
          mux_playback_id = ${muxStream.playbackId},
          streamkey = ${muxStream.streamKey},
          creator = ${JSON.stringify(updatedCreator)},
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(wallet) = LOWER(${wallet})
      `;
    } catch (dbError) {
      console.error("Database update failed:", dbError);
      return routesFError("Failed to save stream data to database", 500);
    }

    // Success
    return routesFSuccess(
      {
        message: "Stream created successfully",
        streamData: {
          streamId: muxStream.id,
          playbackId: muxStream.playbackId,
          streamKey: muxStream.streamKey,
          rtmpUrl: muxStream.rtmpUrl,
          title,
          isActive: muxStream.isActive || false,
        },
      },
      201
    );
  } catch (error) {
    console.error("Stream creation error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return routesFError("Failed to create stream", 500, { details: msg });
  }
}