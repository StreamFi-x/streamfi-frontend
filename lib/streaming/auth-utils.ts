import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * Wallet-based authentication utilities for streaming
 * Handles signature verification and wallet validation
 */

export interface WalletAuthResult {
  isValid: boolean;
  walletAddress: string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  error?: string;
}

export interface SignatureData {
  message: string;
  signature: string;
  walletAddress: string;
  timestamp: number;
}

/**
 * Verify wallet signature for authentication
 * This is a simplified version - in production, you'd want to use proper StarkNet signature verification
 */
export async function verifyWalletSignature(
  signatureData: SignatureData
): Promise<boolean> {
  try {
    // Basic validation
    if (
      !signatureData.message ||
      !signatureData.signature ||
      !signatureData.walletAddress
    ) {
      return false;
    }

    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    const timeDiff = Math.abs(now - signatureData.timestamp);
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (timeDiff > maxAge) {
      console.error("Signature timestamp too old:", timeDiff);
      return false;
    }

    // In a real implementation, you would:
    // 1. Verify the signature using StarkNet's signature verification
    // 2. Ensure the message matches the expected format
    // 3. Validate the wallet address format

    // For now, we'll do basic validation
    const expectedMessage = `StreamFi Authentication: ${signatureData.walletAddress}:${signatureData.timestamp}`;

    if (signatureData.message !== expectedMessage) {
      console.error("Message mismatch:", {
        expected: expectedMessage,
        received: signatureData.message,
      });
      return false;
    }

    // TODO: Implement actual StarkNet signature verification
    // This would involve using the starknet library to verify the signature
    // For now, we'll return true for development purposes
    console.log("Signature verification passed (development mode)");
    return true;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Authenticate wallet and get user information
 */
export async function authenticateWallet(
  request: NextRequest
): Promise<WalletAuthResult> {
  try {
    // Get wallet address from headers or body
    const walletAddress =
      request.headers.get("x-wallet-address") ||
      request.headers.get("wallet-address");

    if (!walletAddress) {
      return {
        isValid: false,
        walletAddress: "",
        error: "Wallet address is required",
      };
    }

    // Get signature data from request body
    let signatureData: SignatureData;
    try {
      const body = await request.json();
      signatureData = {
        message: body.message,
        signature: body.signature,
        walletAddress: body.walletAddress || walletAddress,
        timestamp: body.timestamp,
      };
    } catch {
      return {
        isValid: false,
        walletAddress,
        error: "Invalid request body",
      };
    }

    // Verify signature
    const isSignatureValid = await verifyWalletSignature(signatureData);
    if (!isSignatureValid) {
      return {
        isValid: false,
        walletAddress,
        error: "Invalid signature",
      };
    }

    // Get user information from database
    const userResult = await sql`
      SELECT id, username, email, wallet
      FROM users 
      WHERE LOWER(wallet) = LOWER(${walletAddress})
    `;

    if (userResult.rows.length === 0) {
      return {
        isValid: false,
        walletAddress,
        error: "User not found",
      };
    }

    const user = userResult.rows[0];

    return {
      isValid: true,
      walletAddress,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  } catch (error) {
    console.error("Wallet authentication error:", error);
    return {
      isValid: false,
      walletAddress: "",
      error: "Authentication failed",
    };
  }
}

/**
 * Simple wallet authentication without signature verification (for development)
 */
export async function authenticateWalletSimple(
  request: NextRequest
): Promise<WalletAuthResult> {
  try {
    const walletAddress =
      request.headers.get("x-wallet-address") ||
      request.headers.get("wallet-address");

    if (!walletAddress) {
      return {
        isValid: false,
        walletAddress: "",
        error: "Wallet address is required",
      };
    }

    // Get user information from database
    const userResult = await sql`
      SELECT id, username, email, wallet
      FROM users 
      WHERE LOWER(wallet) = LOWER(${walletAddress})
    `;

    if (userResult.rows.length === 0) {
      return {
        isValid: false,
        walletAddress,
        error: "User not found",
      };
    }

    const user = userResult.rows[0];

    return {
      isValid: true,
      walletAddress,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  } catch (error) {
    console.error("Simple wallet authentication error:", error);
    return {
      isValid: false,
      walletAddress: "",
      error: "Authentication failed",
    };
  }
}

/**
 * Generate authentication message for wallet signing
 */
export function generateAuthMessage(walletAddress: string): string {
  const timestamp = Date.now();
  return `StreamFi Authentication: ${walletAddress}:${timestamp}`;
}

/**
 * Check if a wallet has an active stream
 */
export async function hasActiveStream(walletAddress: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT is_live_v2, livepeer_stream_id_v2
      FROM users 
      WHERE LOWER(wallet) = LOWER(${walletAddress})
    `;

    if (result.rows.length === 0) {
      return false;
    }

    const user = result.rows[0];
    return user.is_live_v2 && !!user.livepeer_stream_id_v2;
  } catch (error) {
    console.error("Error checking active stream:", error);
    return false;
  }
}

/**
 * Get user's stream information
 */
export async function getUserStreamInfo(walletAddress: string): Promise<{
  hasStream: boolean;
  isLive: boolean;
  streamId?: string;
  playbackId?: string;
  streamKey?: string;
}> {
  try {
    const result = await sql`
      SELECT livepeer_stream_id_v2, playback_id_v2, streamkey, is_live_v2
      FROM users 
      WHERE LOWER(wallet) = LOWER(${walletAddress})
    `;

    if (result.rows.length === 0) {
      return {
        hasStream: false,
        isLive: false,
      };
    }

    const user = result.rows[0];
    return {
      hasStream: !!user.livepeer_stream_id_v2,
      isLive: user.is_live_v2,
      streamId: user.livepeer_stream_id_v2,
      playbackId: user.playback_id_v2,
      streamKey: user.streamkey,
    };
  } catch (error) {
    console.error("Error getting user stream info:", error);
    return {
      hasStream: false,
      isLive: false,
    };
  }
}
