import { sql } from "@vercel/postgres";

export type AccessResult =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "password"
        | "invite_only"
        | "paid"
        | "token_gated"
        | "subscription";
      config?: any;
    };

/**
 * Checks if a viewer has access to a streamer's private stream.
 * @param streamerUsername The username of the streamer
 * @param viewerPublicKey The Stellar public key of the viewer (null if not connected)
 */
export async function checkStreamAccess(
  streamerUsername: string,
  viewerPublicKey: string | null
): Promise<AccessResult> {
  try {
    const result = await sql`
      SELECT stream_access_type, stream_access_config
      FROM users
      WHERE LOWER(username) = LOWER(${streamerUsername})
    `;

    if (result.rowCount === 0) {
      // If user not found, default to public (safe fallback)
      return { allowed: true };
    }

    const row = result.rows[0];
    const accessType = row.stream_access_type;
    const config = row.stream_access_config || {};

    if (accessType === "public") {
      return { allowed: true };
    }

    // Delegate to the relevant checker
    // Subsequent issues will implement the full logic for each type
    switch (accessType) {
      case "password":
        return await checkPasswordAccess(config);
      case "invite_only":
        return await checkInviteOnlyAccess(streamerUsername, viewerPublicKey);
      case "paid":
        return await checkPaidAccess(streamerUsername, viewerPublicKey, config);
      case "token_gated":
        return await checkTokenGatedAccess(viewerPublicKey, config);
      case "subscription":
        return await checkSubscriptionAccess(streamerUsername, viewerPublicKey);
      default:
        return { allowed: true };
    }
  } catch (error) {
    console.error("Error checking stream access:", error);
    // On error, we default to allowed: true to avoid blocking streams due to DB issues,
    // though in a production app you might want to be stricter.
    return { allowed: true };
  }
}

// Checker Skeletons - Full implementation added by subsequent issues (2-5)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkPasswordAccess(_config: any): Promise<AccessResult> {
  // Requires password entry on the frontend
  return { allowed: false, reason: "password" };
}

async function checkInviteOnlyAccess(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _streamerUsername: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _viewerPublicKey: string | null
): Promise<AccessResult> {
  // Requires explicit grant in stream_access_grants
  return { allowed: false, reason: "invite_only" };
}

async function checkPaidAccess(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _streamerUsername: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _viewerPublicKey: string | null,
  config: any
): Promise<AccessResult> {
  // Requires payment proof (tx_hash) in stream_access_grants
  return {
    allowed: false,
    reason: "paid",
    config: { price_usdc: config.price_usdc },
  };
}

async function checkTokenGatedAccess(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _viewerPublicKey: string | null,
  config: any
): Promise<AccessResult> {
  // Requires holding specific Stellar asset
  return {
    allowed: false,
    reason: "token_gated",
    config: {
      asset_code: config.asset_code,
      asset_issuer: config.asset_issuer,
      min_balance: config.min_balance,
    },
  };
}

async function checkSubscriptionAccess(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _streamerUsername: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _viewerPublicKey: string | null
): Promise<AccessResult> {
  // Requires active subscription
  return { allowed: false, reason: "subscription" };
}
