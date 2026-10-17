import crypto from "crypto";
import { sql } from "@vercel/postgres";
import { isSubscriptionActive } from "./subscriptions/rpc-client";

export type StreamPrivacy = "public" | "unlisted" | "subscribers_only";

/**
 * Decide whether a viewer can access a creator's stream.
 *
 * Access rules:
 *   - public: anyone
 *   - unlisted: viewer has matching share_token, or viewer is the creator
 *   - subscribers_only: viewer has matching share_token, or has active subscription on-chain,
 *     or is the creator
 *
 * Subscription gating uses Soroban RPC to check on-chain contract state (source of truth).
 * DB subscriptions table is a synced cache only.
 * Falls back to fail-closed (deny) on RPC unavailable.
 */
export interface StreamAccessResult {
  allowed: boolean;
  reason?: string;
  isError?: boolean;
  error?: unknown;
}

export async function canAccessStream(opts: {
  privacy: StreamPrivacy | null;
  streamShareToken: string | null;
  providedToken: string | null;
  creatorUserId: string;
  viewerUserId: string | null;
  creatorWallet?: string | null;
  viewerWallet?: string | null;
}): Promise<StreamAccessResult> {
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

  // Subscribers-only: check active subscription on-chain via Soroban RPC
  if (privacy === "subscribers_only" && opts.viewerUserId) {
    // If wallet addresses are not provided, fetch them from DB
    let creatorWallet = opts.creatorWallet;
    let viewerWallet = opts.viewerWallet;

    if (!creatorWallet || !viewerWallet) {
      try {
        const { rows } = await sql`
          SELECT 
            (SELECT wallet FROM users WHERE id = ${opts.creatorUserId}) AS creator_wallet,
            (SELECT wallet FROM users WHERE id = ${opts.viewerUserId}) AS viewer_wallet
        `;
        if (rows.length > 0) {
          creatorWallet = rows[0].creator_wallet;
          viewerWallet = rows[0].viewer_wallet;
        }
      } catch (err) {
        console.warn("[stream-access] failed to fetch wallets from DB:", err);
        return {
          allowed: false,
          reason: "database_error",
          isError: true,
          error: err,
        };
      }
    }

    // Check on-chain subscription state via Soroban RPC
    if (creatorWallet && viewerWallet) {
      try {
        const isActive = await isSubscriptionActive(
          viewerWallet,
          creatorWallet
        );
        if (isActive) {
          return { allowed: true, reason: "subscription" };
        }
      } catch (err) {
        // RPC client already logs the error; fail-closed (deny) is applied inside isSubscriptionActive
        console.warn(
          "[stream-access] subscription check via RPC failed, denying access:",
          err
        );
        return {
          allowed: false,
          reason: "rpc_error",
          isError: true,
          error: err,
        };
      }
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
