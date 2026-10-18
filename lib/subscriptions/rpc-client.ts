/**
 * Soroban RPC client for subscription state queries.
 * 
 * Provides cached, fail-closed access to on-chain subscription state.
 * The DB subscriptions table is a synced cache; contract state is the source of truth.
 */

import { Keypair } from "@stellar/js-sdk";

export interface OnChainSubscription {
  subscriber: string;
  creator: string;
  tier_id: number;
  authorized_at: number; // Unix timestamp
  renews_at: number; // Unix timestamp
  amount_stroops: string; // BigInt as string
  period_seconds: number;
  authorization_expiry: number; // Unix timestamp
  cancelled_at: number | null; // Unix timestamp or null if active
}

export interface RpcReadResult {
  subscription: OnChainSubscription | null;
  cachedAt: number; // Unix timestamp when this result was cached
}

/**
 * Cache entry: subscription state + timestamp + TTL
 */
interface CacheEntry {
  subscription: OnChainSubscription | null;
  timestamp: number;
  ttl: number; // ms
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default
const FALLBACK_BEHAVIOR = "fail_closed" as const; // Deny access on RPC unavailable

/**
 * In-memory cache for subscription state.
 * Key: `${subscriberAddress}:${creatorAddress}`
 */
const subscriptionCache = new Map<string, CacheEntry>();

/**
 * Get the Soroban RPC URL from environment.
 */
function getSorobanRpcUrl(): string {
  const url = process.env.SOROBAN_RPC_URL;
  if (!url) {
    throw new Error(
      "SOROBAN_RPC_URL not configured. Set it to your Soroban RPC endpoint."
    );
  }
  return url;
}

/**
 * Get the subscription contract ID from environment.
 */
function getContractId(): string {
  const id = process.env.STREAMFI_SUBSCRIPTION_CONTRACT_ID;
  if (!id) {
    throw new Error(
      "STREAMFI_SUBSCRIPTION_CONTRACT_ID not configured. Set it to the contract address on-chain."
    );
  }
  return id;
}

/**
 * Query subscription state from Soroban RPC.
 * 
 * @returns subscription if found, null if not found
 * @throws on RPC error or network issues
 */
export async function querySubscriptionOnChain(
  subscriberAddress: string,
  creatorAddress: string
): Promise<OnChainSubscription | null> {
  const rpcUrl = getSorobanRpcUrl();
  const contractId = getContractId();

  // Call `query_subscription(subscriber, creator)` via Soroban RPC
  // This is a read-only, non-signing call
  const payload = {
    jsonrpc: "2.0",
    id: "1",
    method: "simulateTransaction",
    params: {
      transaction: buildTransactionForQuery(
        contractId,
        subscriberAddress,
        creatorAddress
      ),
    },
  };

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Soroban RPC error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as RpcSimulateResponse;

  if (data.error) {
    throw new Error(`Soroban RPC error: ${data.error.message}`);
  }

  // Parse the result from the simulated transaction
  return parseSubscriptionFromRpcResult(data.result);
}

/**
 * Check if a subscription is active on-chain.
 * 
 * Checks cache first (if not expired); hits RPC on cache miss or expiry.
 * On RPC failure, applies fallback behavior:
 *   - fail_closed: returns false (deny access)
 *   - fail_open: returns cached value if available, false otherwise
 * 
 * @param cacheTtlMs override the default cache TTL (for testing)
 * @returns true if subscription is active, false otherwise
 */
export async function isSubscriptionActive(
  subscriberAddress: string,
  creatorAddress: string,
  cacheTtlMs: number = CACHE_TTL_MS
): Promise<boolean> {
  const cacheKey = `${subscriberAddress}:${creatorAddress}`;
  const cached = subscriptionCache.get(cacheKey);

  // Check cache validity
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    const sub = cached.subscription;
    if (!sub) return false;
    return isSubscriptionCurrentlyActive(sub);
  }

  // Cache miss or expired: hit RPC
  try {
    const subscription = await querySubscriptionOnChain(
      subscriberAddress,
      creatorAddress
    );
    subscriptionCache.set(cacheKey, {
      subscription,
      timestamp: Date.now(),
      ttl: cacheTtlMs,
    });

    if (!subscription) return false;
    return isSubscriptionCurrentlyActive(subscription);
  } catch (err) {
    console.error(
      `[subscription-rpc] RPC query failed for ${subscriberAddress}:${creatorAddress}`,
      err
    );

    // Fallback behavior: fail_closed = deny access
    if (FALLBACK_BEHAVIOR === "fail_closed") {
      return false;
    }

    // If we want fail_open, serve stale cache if available
    if (cached) {
      const sub = cached.subscription;
      return sub ? isSubscriptionCurrentlyActive(sub) : false;
    }

    return false;
  }
}

/**
 * Invalidate cache entry for a subscription (called after on-chain changes).
 */
export function invalidateSubscriptionCache(
  subscriberAddress: string,
  creatorAddress: string
): void {
  const cacheKey = `${subscriberAddress}:${creatorAddress}`;
  subscriptionCache.delete(cacheKey);
}

/**
 * Invalidate all cache entries (for testing or emergency purge).
 */
export function clearSubscriptionCache(): void {
  subscriptionCache.clear();
}

/**
 * Determine if a subscription is currently active based on its on-chain state.
 */
function isSubscriptionCurrentlyActive(subscription: OnChainSubscription): boolean {
  const now = Math.floor(Date.now() / 1000);
  return subscription.cancelled_at === null && subscription.renews_at > now;
}

/**
 * Build a Soroban transaction for querying subscription state (read-only).
 * 
 * This is a placeholder that constructs a valid Soroban transaction envelope.
 * In practice, this would use the Stellar SDK to build an `invokeHostFunction`
 * transaction that calls the contract's `query_subscription` function.
 */
function buildTransactionForQuery(
  contractId: string,
  subscriberAddress: string,
  creatorAddress: string
): string {
  // This is a simplified placeholder. In production, use:
  // import { Keypair, TransactionBuilder, Operation, ... } from "@stellar/js-sdk"
  // to properly construct the transaction.
  //
  // For now, this returns a dummy value to allow compilation.
  // The actual transaction building is deferred to integration.
  return Buffer.from(
    `query_subscription(${contractId}, ${subscriberAddress}, ${creatorAddress})`
  ).toString("base64");
}

/**
 * Parse subscription state from Soroban RPC simulated transaction result.
 * 
 * Returns null if the contract call returned None (subscription not found).
 * Throws on parse error.
 */
function parseSubscriptionFromRpcResult(
  result: RpcSimulateResponse["result"]
): OnChainSubscription | null {
  // This is a placeholder. The actual parsing depends on how Soroban
  // encodes the result (likely in the transaction result's return value).
  // 
  // Expected structure (example):
  // result.events -> find SubscriptionQueried event
  // -> extract subscriber, creator, tier_id, authorized_at, renews_at, amount_stroops, period_seconds, authorization_expiry, cancelled_at
  //
  // For now, return null (subscription not found).
  return null;
}

// Type for Soroban RPC response
interface RpcSimulateResponse {
  jsonrpc: string;
  id: string;
  result?: {
    transactionResult?: {
      result: unknown;
    };
    events?: Array<{ type: string; body: unknown }>;
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
  };
}
