import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  authenticateWalletSimple,
  hasActiveStream,
} from "@/lib/streaming/auth-utils";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * POST /api/v2/streaming/streams/create
 * Create a new stream for authenticated wallet
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate wallet
    const authResult = await authenticateWalletSimple(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: authResult.error || "Authentication failed" },
        { status: 401 }
      );
    }

    // Check if user already has an active stream
    const hasActive = await hasActiveStream(authResult.walletAddress);
    if (hasActive) {
      return NextResponse.json(
        {
          error:
            "User already has an active stream. Please stop the current stream first.",
        },
        { status: 409 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, description, category, tags, record = true } = body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Stream title is required" },
        { status: 400 }
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: "Stream title must be 100 characters or less" },
        { status: 400 }
      );
    }

    if (description && description.length > 500) {
      return NextResponse.json(
        { error: "Stream description must be 500 characters or less" },
        { status: 400 }
      );
    }

    // Create stream with Livepeer
    const streamData = await livepeerService.createStream(
      authResult.walletAddress,
      {
        title: title.trim(),
        description: description?.trim(),
        category: category?.trim(),
        tags: tags || [],
        record,
      }
    );

    // Update user record with stream information
    const updatedCreator = {
      streamTitle: title.trim(),
      description: description?.trim() || "",
      category: category?.trim() || "",
      tags: tags || [],
      lastUpdated: new Date().toISOString(),
    };

    await sql`
      UPDATE users SET
        livepeer_stream_id_v2 = ${streamData.streamId},
        playback_id_v2 = ${streamData.playbackId},
        streamkey = ${streamData.streamKey},
        creator = ${JSON.stringify(updatedCreator)},
        is_live_v2 = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
    `;

    // Create stream session record
    const userResult = await sql`
      SELECT id FROM users WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
    `;
    const userId = userResult.rows[0]?.id;

    if (userId) {
      await sql`
        INSERT INTO stream_sessions_v2 (user_id, livepeer_stream_id, playback_id, stream_key, started_at)
        VALUES (${userId}, ${streamData.streamId}, ${streamData.playbackId}, ${streamData.streamKey}, CURRENT_TIMESTAMP)
      `;
    }

    return NextResponse.json(
      {
        success: true,
        message: "Stream created successfully",
        stream: {
          streamId: streamData.streamId,
          playbackId: streamData.playbackId,
          streamKey: streamData.streamKey,
          ingestUrl: streamData.ingestUrl,
          rtmpUrl: streamData.rtmpUrl,
          title: title.trim(),
          description: description?.trim(),
          category: category?.trim(),
          tags: tags || [],
          isActive: false,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Stream creation error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Livepeer")) {
        return NextResponse.json(
          { error: "Streaming service unavailable. Please try again later." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create stream" },
      { status: 500 }
    );
  }
}
