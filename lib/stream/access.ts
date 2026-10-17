import { sql } from "@vercel/postgres";
import { isSubscriptionActive } from "../subscriptions/rpc-client";

export type StreamAccessReason = "password" | "subscription" | "not_registered";

export type AccessResult =
  | { allowed: true }
  | { allowed: false; reason: StreamAccessReason };

export type ViewerIdentifier =
  | string // wallet public key or user id
  | { userId?: string | null; viewerPublicKey?: string | null };

/**
 * Check subscription access via Soroban RPC.
 *
 * Accepts either:
 * - viewerPublicKey (wallet string, typically starting with 'G')
 * - viewerUserId (UUID of registered user)
 * - an object with `{ userId, viewerPublicKey }` to avoid redundant DB lookups if userId is already known.
 *
 * If a wallet address is provided without a resolved userId and does not match any registered user,
 * it returns `{ allowed: false, reason: "not_registered" }` distinguishing it from an active user
 * who is merely unsubscribed.
 *
 * Fails closed on RPC unavailable (denies access for security).
 */
export async function checkSubscriptionAccess(
  streamerId: string,
  viewer: ViewerIdentifier | null
): Promise<AccessResult> {
  if (!viewer) {
    return { allowed: false, reason: "subscription" };
  }

  let viewerPublicKey: string | null = null;
  let viewerUserId: string | null = null;

  if (typeof viewer === "string") {
    // If it looks like a Stellar public key (starts with 'G' and 50+ chars)
    if (viewer.startsWith("G") && viewer.length >= 50) {
      viewerPublicKey = viewer;
    } else {
      viewerUserId = viewer;
    }
  } else {
    viewerUserId = viewer.userId ?? null;
    viewerPublicKey = viewer.viewerPublicKey ?? null;
  }

  try {
    // If a viewerUserId is provided directly without viewerPublicKey, resolve their wallet from DB
    if (viewerUserId && !viewerPublicKey) {
      const viewerResult = await sql`
        SELECT wallet FROM users WHERE id = ${viewerUserId} AND deleted_at IS NULL LIMIT 1
      `;
      if (!viewerResult?.rows || viewerResult.rows.length === 0) {
        return { allowed: false, reason: "not_registered" };
      }
      viewerPublicKey = viewerResult.rows[0].wallet as string;
    }

    if (!viewerPublicKey) {
      return { allowed: false, reason: "not_registered" };
    }

    // Get streamer's wallet address
    const streamerResult = await sql`
      SELECT wallet FROM users WHERE id = ${streamerId} AND deleted_at IS NULL LIMIT 1
    `;

    if (!streamerResult?.rows || streamerResult.rows.length === 0) {
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
