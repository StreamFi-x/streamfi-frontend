import { NextRequest, NextResponse } from "next/server";
import {
  authenticateWalletSimple,
  hasActiveStream,
  getUserStreamInfo,
} from "@/lib/streaming/auth-utils";

/**
 * GET /api/v2/streaming/auth/session
 * Get current streaming session status for authenticated wallet
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateWalletSimple(request);

    if (!authResult.isValid) {
      return NextResponse.json(
        {
          error: authResult.error || "Authentication failed",
          success: false,
        },
        { status: 401 }
      );
    }

    const streamInfo = await getUserStreamInfo(authResult.walletAddress);
    const hasActive = await hasActiveStream(authResult.walletAddress);

    return NextResponse.json({
      success: true,
      user: authResult.user,
      walletAddress: authResult.walletAddress,
      streamInfo: {
        hasStream: streamInfo.hasStream,
        isLive: streamInfo.isLive,
        hasActiveStream: hasActive,
        streamId: streamInfo.streamId,
        playbackId: streamInfo.playbackId,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/streaming/auth/session
 * Create or refresh streaming session
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateWalletSimple(request);

    if (!authResult.isValid) {
      return NextResponse.json(
        {
          error: authResult.error || "Authentication failed",
          success: false,
        },
        { status: 401 }
      );
    }

    // Check if user already has an active stream
    const hasActive = await hasActiveStream(authResult.walletAddress);

    if (hasActive) {
      return NextResponse.json(
        {
          error: "User already has an active stream",
          success: false,
          hasActiveStream: true,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Streaming session ready",
      user: authResult.user,
      walletAddress: authResult.walletAddress,
      canCreateStream: true,
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        success: false,
      },
      { status: 500 }
    );
  }
}
