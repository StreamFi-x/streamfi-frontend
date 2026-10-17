import { sql } from "@vercel/postgres";
import { isSubscriptionActive } from "../subscriptions/rpc-client";

export type StreamAccessReason =
  "password" | "subscription" | "database_error" | "rpc_error";

export type AccessResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: StreamAccessReason;
      isError?: boolean;
      error?: unknown;
    };

/**
 * Check subscription access via Soroban RPC.
 *
 * Queries the on-chain contract for the current subscription state.
 * DB cache is synced from contract state.
 * Fails closed on RPC unavailable (denies access for security).
 */
export async function checkSubscriptionAccess(
  streamerId: string,
  viewerPublicKey: string | null
): Promise<AccessResult> {
  if (!viewerPublicKey) {
    return { allowed: false, reason: "subscription" };
  }

  let streamerWallet: string;
  try {
    // Get streamer's wallet address
    const streamerResult = await sql`
      SELECT wallet FROM users WHERE id = ${streamerId} AND deleted_at IS NULL LIMIT 1
    `;

    if (streamerResult.rows.length === 0) {
      return { allowed: false, reason: "subscription" };
    }

    streamerWallet = streamerResult.rows[0].wallet as string;
  } catch (err) {
    console.error(
      "[stream-access] checkSubscriptionAccess database query failed:",
      err
    );
    return {
      allowed: false,
      reason: "database_error",
      isError: true,
      error: err,
    };
  }

  try {
    // Check on-chain subscription state via Soroban RPC
    const isActive = await isSubscriptionActive(
      viewerPublicKey,
      streamerWallet
    );

    return isActive
      ? { allowed: true }
      : { allowed: false, reason: "subscription" };
  } catch (err) {
    console.error("[stream-access] checkSubscriptionAccess RPC failed:", err);
    return {
      allowed: false,
      reason: "rpc_error",
      isError: true,
      error: err,
    };
  }
}
