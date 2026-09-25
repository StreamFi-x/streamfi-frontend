import { randomBytes, createHash } from "crypto";
import { sql } from "@vercel/postgres";
import {
  ApiKeyRecord,
  ApiKeyPublicInfo,
  ApiKeyTier,
} from "./types";
import { MAX_ACTIVE_KEYS_PER_USER } from "./tier-config";

/**
 * In-memory fallback store for development, testing, and environments where the
 * api_keys table has not yet been migrated.
 */
const memoryStore = new Map<string, ApiKeyRecord>();

/**
 * Hash raw API key for secure storage at rest using SHA-256.
 * The raw secret key is never stored in the database.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generate a new cryptographically secure API key string.
 * Format: sf_live_<48 hex chars>
 */
export function generateKeyString(): string {
  const token = randomBytes(24).toString("hex");
  return `sf_live_${token}`;
}

/**
 * Format public display prefix (e.g. "sf_live_a1b2c3d4...")
 */
export function getDisplayPrefix(rawKey: string): string {
  return `${rawKey.slice(0, 16)}...`;
}

function sanitizeRecord(record: ApiKeyRecord): ApiKeyPublicInfo {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    keyPrefix: record.keyPrefix,
    tier: record.tier,
    status: record.status,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
  };
}

/**
 * Generates an API key for a verified user.
 * Returns the public metadata along with the full secret key (returned ONLY once).
 */
export async function createApiKey(
  userId: string,
  name: string,
  tier: ApiKeyTier = "free"
): Promise<{ apiKey: ApiKeyPublicInfo; secretKey: string }> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("API key name is required");
  }

  // 1. Abuse prevention: enforce per-account active key limit
  const activeKeys = await getActiveKeysCount(userId);
  if (activeKeys >= MAX_ACTIVE_KEYS_PER_USER) {
    throw new Error(
      `Active API key limit reached (maximum ${MAX_ACTIVE_KEYS_PER_USER} active keys). Please revoke an unused key before creating a new one.`
    );
  }

  // 2. Generate key and hash
  const rawKey = generateKeyString();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getDisplayPrefix(rawKey);
  const now = new Date().toISOString();

  let insertedRecord: ApiKeyRecord;

  try {
    const { rows } = await sql`
      INSERT INTO api_keys (
        user_id,
        name,
        key_prefix,
        key_hash,
        tier,
        status,
        created_at
      )
      VALUES (
        ${userId},
        ${trimmedName},
        ${keyPrefix},
        ${keyHash},
        ${tier},
        'active',
        ${now}
      )
      RETURNING id, user_id, name, key_prefix, key_hash, tier, status, created_at, last_used_at, revoked_at
    `;

    const row = rows[0];
    insertedRecord = {
      id: String(row.id),
      userId: String(row.user_id),
      name: row.name,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      tier: row.tier as ApiKeyTier,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    };
  } catch (_err) {
    // In-memory fallback
    const id = `key_${randomBytes(8).toString("hex")}`;
    insertedRecord = {
      id,
      userId,
      name: trimmedName,
      keyPrefix,
      keyHash,
      tier,
      status: "active",
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    };
  }

  memoryStore.set(insertedRecord.keyHash, insertedRecord);

  return {
    apiKey: sanitizeRecord(insertedRecord),
    secretKey: rawKey,
  };
}

/**
 * List all API keys (active and revoked) for a user account.
 */
export async function listApiKeys(userId: string): Promise<ApiKeyPublicInfo[]> {
  try {
    const { rows } = await sql`
      SELECT id, user_id, name, key_prefix, key_hash, tier, status, created_at, last_used_at, revoked_at
      FROM api_keys
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return rows.map(row => ({
      id: String(row.id),
      userId: String(row.user_id),
      name: row.name,
      keyPrefix: row.key_prefix,
      tier: row.tier as ApiKeyTier,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    }));
  } catch {
    // Memory store fallback
    const userKeys = Array.from(memoryStore.values()).filter(
      k => k.userId === userId
    );
    userKeys.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return userKeys.map(sanitizeRecord);
  }
}

/**
 * Count active keys for a user account to enforce aggregate quota limits.
 */
export async function getActiveKeysCount(userId: string): Promise<number> {
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int as count
      FROM api_keys
      WHERE user_id = ${userId} AND status = 'active'
    `;
    return rows[0]?.count ?? 0;
  } catch {
    return Array.from(memoryStore.values()).filter(
      k => k.userId === userId && k.status === "active"
    ).length;
  }
}

/**
 * Revoke an API key immediately.
 */
export async function revokeApiKey(
  userId: string,
  keyId: string
): Promise<ApiKeyPublicInfo> {
  const now = new Date().toISOString();

  try {
    const { rows } = await sql`
      UPDATE api_keys
      SET status = 'revoked', revoked_at = ${now}
      WHERE id = ${keyId} AND user_id = ${userId}
      RETURNING id, user_id, name, key_prefix, key_hash, tier, status, created_at, last_used_at, revoked_at
    `;

    if (rows.length === 0) {
      throw new Error("Key not found or not owned by caller");
    }

    const row = rows[0];
    const updated: ApiKeyRecord = {
      id: String(row.id),
      userId: String(row.user_id),
      name: row.name,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      tier: row.tier as ApiKeyTier,
      status: "revoked",
      createdAt: new Date(row.created_at).toISOString(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      revokedAt: now,
    };
    memoryStore.set(updated.keyHash, updated);
    return sanitizeRecord(updated);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Key not found")) {
      throw err;
    }
    // Memory store fallback
    const key = Array.from(memoryStore.values()).find(
      k => k.id === keyId && k.userId === userId
    );
    if (!key) {
      throw new Error("Key not found or not owned by caller");
    }
    key.status = "revoked";
    key.revokedAt = now;
    memoryStore.set(key.keyHash, key);
    return sanitizeRecord(key);
  }
}

/**
 * Rotate an existing API key.
 * Immediately revokes the old key and generates a new key with the same name and tier.
 */
export async function rotateApiKey(
  userId: string,
  keyId: string
): Promise<{
  oldKeyId: string;
  newApiKey: ApiKeyPublicInfo;
  secretKey: string;
}> {
  // 1. Revoke the old key first
  const oldKey = await revokeApiKey(userId, keyId);

  // 2. Issue a replacement key with the same name and tier
  const result = await createApiKey(userId, oldKey.name, oldKey.tier);

  return {
    oldKeyId: keyId,
    newApiKey: result.apiKey,
    secretKey: result.secretKey,
  };
}

/**
 * Validate a raw API key presented on an incoming request.
 * Checks hash against DB/store and ensures status is 'active'.
 * Returns full record if valid, or null if invalid or revoked.
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
  if (!rawKey || !rawKey.startsWith("sf_live_")) {
    return null;
  }

  const hash = hashApiKey(rawKey);

  // Check memory store first for immediate local lookups
  const cached = memoryStore.get(hash);
  if (cached) {
    if (cached.status !== "active") {
      return null;
    }
    return cached;
  }

  try {
    const { rows } = await sql`
      SELECT id, user_id, name, key_prefix, key_hash, tier, status, created_at, last_used_at, revoked_at
      FROM api_keys
      WHERE key_hash = ${hash} AND status = 'active'
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const record: ApiKeyRecord = {
      id: String(row.id),
      userId: String(row.user_id),
      name: row.name,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      tier: row.tier as ApiKeyTier,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    };

    memoryStore.set(hash, record);
    return record;
  } catch {
    return null;
  }
}

/** Touch last_used_at timestamp */
export async function touchApiKey(keyId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await sql`
      UPDATE api_keys
      SET last_used_at = ${now}
      WHERE id = ${keyId}
    `;
  } catch {
    // Non-critical
  }
}

/** For testing: clear memory store */
export function _resetMemoryStore(): void {
  memoryStore.clear();
}
