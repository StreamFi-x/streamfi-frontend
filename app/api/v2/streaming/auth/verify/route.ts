import { NextRequest, NextResponse } from "next/server";
import {
  authenticateWallet,
  generateAuthMessage,
} from "@/lib/streaming/auth-utils";

/**
 * POST /api/v2/streaming/auth/verify
 * Verify wallet signature for streaming authentication
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateWallet(request);

    if (!authResult.isValid) {
      return NextResponse.json(
        {
          error: authResult.error || "Authentication failed",
          success: false,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Wallet authenticated successfully",
      user: authResult.user,
      walletAddress: authResult.walletAddress,
    });
  } catch (error) {
    console.error("Auth verification error:", error);
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
 * GET /api/v2/streaming/auth/verify
 * Get authentication message for wallet signing
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress =
      request.headers.get("x-wallet-address") ||
      request.headers.get("wallet-address");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const authMessage = generateAuthMessage(walletAddress);
    const timestamp = Date.now();

    return NextResponse.json({
      message: authMessage,
      timestamp,
      walletAddress,
      instructions:
        "Sign this message with your wallet to authenticate for streaming",
    });
  } catch (error) {
    console.error("Auth message generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication message" },
      { status: 500 }
    );
  }
}
