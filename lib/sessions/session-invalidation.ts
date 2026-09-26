/**
 * Session Invalidation Event System (#1385)
 *
 * Provides a first-class invalidation event mechanism that any cache layer
 * must integrate with before caching session validity. This ensures that
 * session revocation propagates to all consumers, including future caching layers.
 */

import { sql } from "@vercel/postgres";

export interface SessionInvalidationEvent {
  userId: string;
  sessionId?: string;
  /** The raw token that was revoked (for direct cache invalidation) */
  rawToken?: string;
  /** Timestamp when invalidation occurred */
  invalidatedAt: Date;
  /** Reason for invalidation */
  reason: "logout" | "security" | "admin" | "migration";
}

/**
 * Publish a session invalidation event
 * This can be extended to use pub/sub (Redis, etc.) for multi-instance deployments
 */
export async function publishInvalidationEvent(
  event: SessionInvalidationEvent
): Promise<void> {
  try {
    // Store invalidation event in database for audit trail
    await sql`
      INSERT INTO session_invalidations 
        (user_id, session_id, raw_token_hash, invalidated_at, reason)
      VALUES (
        ${event.userId},
        ${event.sessionId ?? null},
        ${event.rawToken ? hashToken(event.rawToken) : null},
        ${event.invalidatedAt},
        ${event.reason}
      )
    `;

    // TODO: In multi-instance deployments, publish to Redis pub/sub
    // Redis.publish("session:invalidation", JSON.stringify(event));
  } catch (error) {
    console.error("[session-invalidation] Failed to publish event:", error);
    // Don't throw - invalidation should still proceed via database flag
  }
}

/**
 * Check if a session has been invalidated via the event system
 * This is the contract that any cache layer must implement
 */
export async function isSessionInvalidated(
  userId: string,
  rawToken: string
): Promise<boolean> {
  try {
    const tokenHash = hashToken(rawToken);
    const { rows } = await sql`
      SELECT id 
      FROM session_invalidations
      WHERE user_id = ${userId}
        AND raw_token_hash = ${tokenHash}
        AND invalidated_at > NOW() - INTERVAL '30 days'
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    // If table doesn't exist yet, assume not invalidated
    return false;
  }
}

/**
 * Helper function to hash tokens (consistent with user-sessions)
 */
function hashToken(rawToken: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Invalidatable session interface
 * Any cache layer must implement this contract
 */
export interface InvalidatableSessionCache {
  /**
   * Check if a session is valid, respecting invalidation events
   * @param userId User ID
   * @param rawToken Raw session token
   * @returns true if session is valid, false if invalidated
   */
  isValid(userId: string, rawToken: string): Promise<boolean>;

  /**
   * Invalidate a cached session entry
   * Called when an invalidation event is published
   */
  invalidate(userId: string, rawToken: string): Promise<void>;

  /**
   * Subscribe to invalidation events
   * For multi-instance deployments, this would subscribe to pub/sub
   */
  subscribeToInvalidations?(callback: (event: SessionInvalidationEvent) => void): void;
}