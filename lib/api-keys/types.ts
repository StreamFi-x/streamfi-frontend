export type ApiKeyTier = "free" | "creator" | "pro" | "enterprise";
export type ApiKeyStatus = "active" | "revoked";

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  tier: ApiKeyTier;
  status: ApiKeyStatus;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ApiKeyPublicInfo {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  tier: ApiKeyTier;
  status: ApiKeyStatus;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface TierConfig {
  name: ApiKeyTier | "anonymous";
  requestsPerWindow: number;
  accountAggregateLimit: number;
  windowMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  status?: number;
  error?: string;
  tier: ApiKeyTier | "anonymous";
  keyId?: string;
  userId?: string;
  retryAfterSeconds?: number;
}
