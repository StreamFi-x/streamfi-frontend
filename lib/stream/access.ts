import { sql } from "@vercel/postgres";
import { isSubscriptionActive } from "./subscriptions/rpc-client";

export type StreamAccessReason = "password" | "subscription";

export type AccessResult =
  | { allowed: true }
  | { allowed: false; reason: StreamAccessReason };

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

  try {
    // Get streamer's wallet address
    const streamerResult = await sql`
      SELECT wallet FROM users WHERE id = ${streamerId} AND deleted_at IS NULL LIMIT 1
    `;

    if (streamerResult.rows.length === 0) {
      return { allowed: false, reason: "subscription" };
    }

    const streamerWallet = streamerResult.rows[0].wallet as string;

    // Check on-chain subscription state via Soroban RPC
    const isActive = await isSubscriptionActive(
      viewerPublicKey,
      streamerWallet
    );

    return isActive
      ? { allowed: true }
      : { allowed: false, reason: "subscription" };
  } catch (err) {
    console.error("[stream-access] checkSubscriptionAccess failed:", err);
    // Fail closed: deny access on any error
    return { allowed: false, reason: "subscription" };
  }
}
