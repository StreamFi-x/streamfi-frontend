/**
 * lib/realtime/tokens.ts
 *
 * Scoped auth token minting and verification for Realtime connections.
 * Ensures subscribers can only connect to channels they are authorized for.
 */

import { signToken } from "@/lib/auth/sign-token";
import crypto from "crypto";

export interface RealtimeTokenPayload {
  userId?: string;
  wallet?: string;
  channels: string[];
  iat: number;
  exp: number;
}

const TOKEN_TTL_SECONDS = 3600; // 1 hour token lifetime

function getRealtimeSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || "streamfi-realtime-secret-key-fallback";
}

/**
 * Mint a scoped token for an authorized set of channels.
 */
export function mintRealtimeToken(
  channels: string[],
  user?: { userId?: string; wallet?: string }
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: RealtimeTokenPayload = {
    userId: user?.userId,
    wallet: user?.wallet,
    channels,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  return signToken(payload, getRealtimeSecret());
}

/**
 * Verify a realtime token and ensure the requested channels are authorized.
 */
export function verifyRealtimeToken(
  tokenString: string,
  requestedChannels?: string[]
): { ok: true; payload: RealtimeTokenPayload } | { ok: false; reason: string } {
  try {
    const parts = tokenString.split(".");
    if (parts.length !== 3) {
      return { ok: false, reason: "Malformed token structure" };
    }

    const [headerB64, payloadB64, sigB64] = parts;
    const dataToSign = `${headerB64}.${payloadB64}`;
    const secret = getRealtimeSecret();

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(dataToSign)
      .digest("base64url");

    if (sigB64 !== expectedSig) {
      return { ok: false, reason: "Invalid token signature" };
    }

    const payload: RealtimeTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { ok: false, reason: "Token expired" };
    }

    if (requestedChannels && requestedChannels.length > 0) {
      const allowedSet = new Set(payload.channels || []);
      for (const ch of requestedChannels) {
        if (!allowedSet.has(ch) && !allowedSet.has("*")) {
          return {
            ok: false,
            reason: `Unauthorized channel subscription: ${ch}`,
          };
        }
      }
    }

    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: "Token parsing error" };
  }
}

/**
 * Validate whether a user can subscribe to requested channels based on permissions.
 */
export function isChannelAllowedForUser(
  channel: string,
  user?: { userId?: string; wallet?: string }
): boolean {
  // Public channels: chat, presence, stream-status, overlays
  if (
    channel.startsWith("stream:") &&
    (channel.endsWith(":chat") ||
      channel.endsWith(":presence") ||
      channel.endsWith(":status") ||
      channel.endsWith(":overlay"))
  ) {
    return true;
  }

  // Creator private channels require authenticated user
  if (channel.startsWith("creator:") && user?.userId) {
    return true;
  }

  // Moderator private channels require auth
  if (channel.endsWith(":mod") && user?.userId) {
    return true;
  }

  return false;
}
