/**
 * Stream access-control logic.
 *
 * All checks run server-side — the viewer's wallet address is never trusted
 * from the client without server verification.
 *
 * Caching: access results are cached in Redis (Upstash) for 60 seconds per
 * viewer per streamer to avoid hammering Stellar Horizon on every page load.
 * Falls back gracefully to no-cache when Redis is not configured.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { getHorizonUrl, getStellarNetwork } from "@/lib/stellar/config";
import type { AccessResult, TokenGateConfig } from "@/types/stream-access";

// ── Redis cache (optional) ─────────────────────────────────────────────────

let _redis: import("@upstash/redis").Redis | null = null;

async function getRedis(): Promise<import("@upstash/redis").Redis | null> {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  if (!_redis) {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

const CACHE_TTL_SECONDS = 60;

function cacheKey(streamerId: string, viewerPublicKey: string): string {
  return `token-gate:${streamerId}:${viewerPublicKey}`;
}

// ── Core access check ──────────────────────────────────────────────────────

/**
 * Check whether a viewer holds enough of a Stellar asset to access a
 * token-gated stream.
 *
 * @param config          Token gate settings (asset_code, asset_issuer, min_balance)
 * @param viewerPublicKey Stellar public key of the viewer (null if no wallet connected)
 * @param streamerId      Used only as part of the cache key
 */
export async function checkTokenGatedAccess(
  config: TokenGateConfig,
  viewerPublicKey: string | null,
  streamerId: string
): Promise<AccessResult> {
  if (!viewerPublicKey) {
    return { allowed: false, reason: "no_wallet" };
  }

  // Check cache first
  const redis = await getRedis();
  if (redis) {
    try {
      const cached = await redis.get<AccessResult>(
        cacheKey(streamerId, viewerPublicKey)
      );
      if (cached) { return cached; }
    } catch {
      // Cache miss is non-fatal — proceed to live check
    }
  }

  const result = await fetchTokenBalance(config, viewerPublicKey);

  // Write result to cache
  if (redis) {
    try {
      await redis.setex(
        cacheKey(streamerId, viewerPublicKey),
        CACHE_TTL_SECONDS,
        JSON.stringify(result)
      );
    } catch {
      // Cache write failure is non-fatal
    }
  }

  return result;
}

async function fetchTokenBalance(
  config: TokenGateConfig,
  viewerPublicKey: string
): Promise<AccessResult> {
  try {
    const network = getStellarNetwork();
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(network));
    const account = await server.accounts().accountId(viewerPublicKey).call();

    const balance = (account.balances as any[]).find(
      b =>
        b.asset_type !== "native" &&
        b.asset_code === config.asset_code &&
        b.asset_issuer === config.asset_issuer
    );

    const held = parseFloat(balance?.balance ?? "0");
    const required = parseFloat(config.min_balance ?? "1");

    return held >= required
      ? { allowed: true }
      : { allowed: false, reason: "token_gated" };
  } catch {
    // Account not found on Stellar = no balance
    return { allowed: false, reason: "token_gated" };
  }
}

// ── Asset existence check ──────────────────────────────────────────────────

/**
 * Verify that a Stellar asset has been issued (has at least one trustline).
 * Used by the dashboard "Verify asset" button.
 */
export async function verifyAssetExists(
  assetCode: string,
  assetIssuer: string
): Promise<boolean> {
  try {
    const network = getStellarNetwork();
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(network));
    const assets = await server
      .assets()
      .forCode(assetCode)
      .forIssuer(assetIssuer)
      .limit(1)
      .call();
    return assets.records.length > 0;
  } catch {
    return false;
  }
}

// ── Input validation ───────────────────────────────────────────────────────

export function isValidAssetCode(code: string): boolean {
  // Stellar asset codes: 1–12 alphanumeric characters
  return /^[A-Za-z0-9]{1,12}$/.test(code);
}

export function isValidStellarIssuer(key: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(key);
}
