import crypto from "crypto";
import { sql } from "@vercel/postgres";

export type StreamPrivacy = "public" | "unlisted" | "subscribers_only";

/**
 * Decide whether a viewer can access a creator's stream.
 *
 * Access rules:
 *   - public: anyone
 *   - unlisted: viewer has matching share_token, or viewer is the creator
 *   - subscribers_only: viewer has matching share_token, or has active subscription,
 *     or is the creator
 *
 * NOTE: Subscriber gating currently only checks the share_token + creator self-access.
 * Active-subscription checks will activate once the subscriptions table is populated
 * via real Stellar payments.
 */
export async function canAccessStream(opts: {
  privacy: StreamPrivacy | null;
  streamShareToken: string | null;
  providedToken: string | null;
  creatorUserId: string;
  viewerUserId: string | null;
}): Promise<{ allowed: boolean; reason?: string }> {
  const privacy = (opts.privacy ?? "public") as StreamPrivacy;

  if (privacy === "public") {
    return { allowed: true };
  }

  // Creator viewing own stream always has access
  if (opts.viewerUserId && opts.viewerUserId === opts.creatorUserId) {
    return { allowed: true, reason: "owner" };
  }

  // Token in URL matches stored token
  if (
    opts.providedToken &&
    opts.streamShareToken &&
    constantTimeEquals(opts.providedToken, opts.streamShareToken)
  ) {
    return { allowed: true, reason: "share_token" };
  }

  // Subscribers-only: check active subscription (defers to share_token gate for now,
  // but we still query in case a paid subscription has been seeded).
  if (privacy === "subscribers_only" && opts.viewerUserId) {
    try {
      const result = await sql`
        SELECT 1 FROM subscriptions
        WHERE subscriber_id = ${opts.viewerUserId}
          AND creator_id = ${opts.creatorUserId}
          AND status = 'active'
          AND expires_at > NOW()
        LIMIT 1
      `;
      if (result.rows.length > 0) {
        return { allowed: true, reason: "subscription" };
      }
    } catch (err) {
      // If subscriptions table doesn't exist yet, just treat as denied silently
      console.warn("[stream-access] subscriptions check failed:", err);
    }
  }

  return {
    allowed: false,
    reason: privacy === "unlisted" ? "needs_invite_link" : "needs_subscription",
  };
}

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return crypto.timingSafeEqual(aBuf, bBuf);
}
