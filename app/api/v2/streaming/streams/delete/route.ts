import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  authenticateWalletSimple,
  getUserStreamInfo,
} from "@/lib/streaming/auth-utils";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * DELETE /api/v2/streaming/streams/delete
 * Delete stream for authenticated wallet
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate wallet
    const authResult = await authenticateWalletSimple(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: authResult.error || "Authentication failed" },
        { status: 401 }
      );
    }

    // Get user's stream information
    const streamInfo = await getUserStreamInfo(authResult.walletAddress);

    if (!streamInfo.hasStream) {
      return NextResponse.json(
        { error: "No stream found to delete" },
        { status: 404 }
      );
    }

    // If stream is live, stop it first
    if (streamInfo.isLive) {
      await sql`
        UPDATE users SET
          is_live_v2 = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
      `;
    }

    // Delete stream from Livepeer
    if (streamInfo.streamId) {
      try {
        await livepeerService.deleteStream(streamInfo.streamId);
        console.log(
          "Livepeer stream deleted successfully:",
          streamInfo.streamId
        );
      } catch (livepeerError) {
        console.error("Failed to delete Livepeer stream:", livepeerError);
        // Continue with database cleanup even if Livepeer deletion fails
      }
    }

    // Clear stream data from user record
    await sql`
      UPDATE users SET
        livepeer_stream_id_v2 = NULL,
        playback_id_v2 = NULL,
        streamkey = NULL,
        is_live_v2 = false,
        stream_started_at_v2 = NULL,
        creator = jsonb_set(creator, '{streamTitle}', '""'),
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
    `;

    // Mark stream sessions as ended
    const userResult = await sql`
      SELECT id FROM users WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
    `;
    const userId = userResult.rows[0]?.id;

    if (userId && streamInfo.streamId) {
      await sql`
        UPDATE stream_sessions_v2 
        SET ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId} AND livepeer_stream_id = ${streamInfo.streamId}
      `;
    }

    return NextResponse.json({
      success: true,
      message: "Stream deleted successfully",
      deletedStream: {
        streamId: streamInfo.streamId,
        playbackId: streamInfo.playbackId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Stream deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete stream" },
      { status: 500 }
    );
  }
}
