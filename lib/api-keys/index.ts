/**
 * API Key Management and Rate-Limit Tiering.
 *
 * Responsibilities:
 *  - Secure API key generation with 'sf_live_' prefix and cryptographic entropy
 *  - At-rest SHA-256 hashing (plaintext keys are NEVER persisted)
 *  - Tier definitions (free, creator, partner) with per-key and per-account limits
 *  - Key lifecycle management: issuance, listing, rotation, and immediate revocation
 *  - Per-account key issuance capping to prevent quota multiplication attacks
 */

import { randomBytes, createHash } from "crypto";
import { sql } from "@vercel/postgres";

export type ApiKeyTier = "free" | "creator" | "partner";

export interface TierLimits {
  tier: ApiKeyTier;
  keyLimitPerMin: number;
  accountLimitPerMin: number;
}

export const TIER_LIMITS: Record<ApiKeyTier, TierLimits> = {
  free: {
    tier: "free",
    keyLimitPerMin: 60,
    accountLimitPerMin: 180,
  },
  creator: {
    tier: "creator",
    keyLimitPerMin: 300,
    accountLimitPerMin: 900,
  },
  partner: {
    tier: "partner",
    keyLimitPerMin: 1000,
    accountLimitPerMin: 3000,
  },
};

export const ANONYMOUS_IP_LIMIT_PER_MIN = 30;
export const MAX_ACTIVE_KEYS_PER_USER = 5;

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  tier: ApiKeyTier;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  isRevoked: boolean;
}

export type ApiKeyValidationResult =
  | {
      valid: true;
      keyId: string;
      userId: string;
      tier: ApiKeyTier;
      limits: TierLimits;
    }
  | {
      valid: false;
      reason: "invalid_key_format" | "key_not_found" | "key_revoked" | "key_expired";
    };

// ── In-Memory Store Fallback for tests & environments without live Postgres ────

interface StoredApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  tier: ApiKeyTier;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
}

const memoryStore = new Map<string, StoredApiKey>(); // keyed by keyHash

export function _resetApiKeyMemoryStore() {
  memoryStore.clear();
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey.trim()).digest("hex");
}

function generateRawKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const hex = randomBytes(24).toString("hex");
  const rawKey = `sf_live_${hex}`;
  const keyPrefix = `sf_live_${hex.slice(0, 4)}...${hex.slice(-4)}`;
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Creates a new API key for the authenticated user.
 * Plaintext secret is returned ONLY in this response.
 */
export async function createApiKey(
  userId: string,
  name: string,
  tier: ApiKeyTier = "free"
): Promise<{ apiKey: ApiKeyRecord; rawKey: string }> {
  if (!name || name.trim().length === 0) {
    throw new Error("API key name is required");
  }
  if (!TIER_LIMITS[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  // Check active key count to prevent quota multiplication
  const activeKeys = await getActiveKeysCount(userId);
  if (activeKeys >= MAX_ACTIVE_KEYS_PER_USER) {
    throw new Error(
      `Cannot exceed maximum of ${MAX_ACTIVE_KEYS_PER_USER} active API keys per account`
    );
  }

  const { rawKey, keyPrefix, keyHash } = generateRawKey();
  const id = randomBytes(16).toString("hex");
  const now = new Date();

  try {
    const result = await sql`
      INSERT INTO api_keys (
        user_id,
        name,
        key_prefix,
        key_hash,
        tier,
        created_at
      )
      VALUES (${userId}, ${name.trim()}, ${keyPrefix}, ${keyHash}, ${tier}, ${now.toISOString()})
      RETURNING id, user_id, name, key_prefix, tier, created_at, last_used_at, revoked_at
    `;

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const apiKey: ApiKeyRecord = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        keyPrefix: row.key_prefix,
        tier: row.tier as ApiKeyTier,
        createdAt: new Date(row.created_at),
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
        revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
        isRevoked: !!row.revoked_at,
      };
      // Keep memory store synced
      memoryStore.set(keyHash, {
        id: apiKey.id,
        userId,
        name: apiKey.name,
        keyPrefix,
        keyHash,
        tier,
        createdAt: apiKey.createdAt,
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
      });
      return { apiKey, rawKey };
    }
  } catch {
    // Database fallback to memory store
  }

  const record: StoredApiKey = {
    id,
    userId,
    name: name.trim(),
    keyPrefix,
    keyHash,
    tier,
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
    expiresAt: null,
  };
  memoryStore.set(keyHash, record);

  return {
    apiKey: {
      id: record.id,
      userId: record.userId,
      name: record.name,
      keyPrefix: record.keyPrefix,
      tier: record.tier,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      revokedAt: record.revokedAt,
      isRevoked: false,
    },
    rawKey,
  };
}

/**
 * Returns the count of active (non-revoked) API keys for an account.
 */
async function getActiveKeysCount(userId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(*)::int as count
      FROM api_keys
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
    `;
    if (result.rows.length > 0) {
      return result.rows[0].count;
    }
  } catch {
    // Database query failed, check memory store
  }

  let count = 0;
  for (const item of memoryStore.values()) {
    if (item.userId === userId && !item.revokedAt) {
      count++;
    }
  }
  return count;
}

/**
 * Lists all API keys for an authenticated user.
 * Never exposes raw secret keys or key hashes.
 */
export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  try {
    const result = await sql`
      SELECT id, user_id, name, key_prefix, tier, created_at, last_used_at, revoked_at
      FROM api_keys
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    if (result.rows.length > 0) {
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        keyPrefix: row.key_prefix,
        tier: row.tier as ApiKeyTier,
        createdAt: new Date(row.created_at),
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
        revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
        isRevoked: !!row.revoked_at,
      }));
    }
  } catch {
    // Database query fallback to memory store
  }

  const keys: ApiKeyRecord[] = [];
  for (const item of memoryStore.values()) {
    if (item.userId === userId) {
      keys.push({
        id: item.id,
        userId: item.userId,
        name: item.name,
        keyPrefix: item.keyPrefix,
        tier: item.tier,
        createdAt: item.createdAt,
        lastUsedAt: item.lastUsedAt,
        revokedAt: item.revokedAt,
        isRevoked: !!item.revokedAt,
      });
    }
  }
  return keys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Revokes an API key immediately.
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const now = new Date();
  let updatedInDb = false;

  try {
    const result = await sql`
      UPDATE api_keys
      SET revoked_at = ${now.toISOString()}
      WHERE id = ${keyId}
        AND user_id = ${userId}
        AND revoked_at IS NULL
      RETURNING id
    `;
    if (result.rows.length > 0) {
      updatedInDb = true;
    }
  } catch {
    // Database fallback
  }

  // Update memory store
  for (const item of memoryStore.values()) {
    if (item.id === keyId && item.userId === userId && !item.revokedAt) {
      item.revokedAt = now;
      return true;
    }
  }

  return updatedInDb;
}

/**
 * Rotates an existing API key immediately:
 * Invalides the previous key and issues a new secret under the same name and tier.
 */
export async function rotateApiKey(
  userId: string,
  keyId: string
): Promise<{ apiKey: ApiKeyRecord; rawKey: string }> {
  // First, find existing key details
  let existingKey: { name: string; tier: ApiKeyTier } | null = null;

  try {
    const result = await sql`
      SELECT name, tier
      FROM api_keys
      WHERE id = ${keyId} AND user_id = ${userId}
    `;
    if (result.rows.length > 0) {
      existingKey = {
        name: result.rows[0].name,
        tier: result.rows[0].tier as ApiKeyTier,
      };
    }
  } catch {
    // DB fallback
  }

  if (!existingKey) {
    for (const item of memoryStore.values()) {
      if (item.id === keyId && item.userId === userId) {
        existingKey = { name: item.name, tier: item.tier };
        break;
      }
    }
  }

  if (!existingKey) {
    throw new Error("API key not found");
  }

  // Revoke previous key immediately
  await revokeApiKey(userId, keyId);

  // Generate and return new key
  return createApiKey(userId, existingKey.name, existingKey.tier);
}

/**
 * Validates a client-supplied API key.
 * Fast constant-time lookup by SHA-256 hash.
 * Checks for revocation and expiration.
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyValidationResult> {
  if (!rawKey || !rawKey.startsWith("sf_live_")) {
    return { valid: false, reason: "invalid_key_format" };
  }

  const hash = hashApiKey(rawKey);

  // Try DB first
  try {
    const result = await sql`
      SELECT id, user_id, tier, revoked_at, expires_at
      FROM api_keys
      WHERE key_hash = ${hash}
      LIMIT 1
    `;
    if (result.rows.length > 0) {
      const row = result.rows[0];
      if (row.revoked_at) {
        return { valid: false, reason: "key_revoked" };
      }
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return { valid: false, reason: "key_expired" };
      }

      // Touch last_used_at asynchronously
      sql`
        UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ${row.id}
      `.catch(() => {});

      const tier = (row.tier as ApiKeyTier) in TIER_LIMITS ? (row.tier as ApiKeyTier) : "free";
      return {
        valid: true,
        keyId: row.id,
        userId: row.user_id,
        tier,
        limits: TIER_LIMITS[tier],
      };
    }
  } catch {
    // DB lookup fallback
  }

  // Check memory store
  const stored = memoryStore.get(hash);
  if (!stored) {
    return { valid: false, reason: "key_not_found" };
  }

  if (stored.revokedAt) {
    return { valid: false, reason: "key_revoked" };
  }
  if (stored.expiresAt && stored.expiresAt < new Date()) {
    return { valid: false, reason: "key_expired" };
  }

  stored.lastUsedAt = new Date();
  return {
    valid: true,
    keyId: stored.id,
    userId: stored.userId,
    tier: stored.tier,
    limits: TIER_LIMITS[stored.tier],
  };
}
