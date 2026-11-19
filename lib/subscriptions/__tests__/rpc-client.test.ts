/**
 * @jest-environment node
 * 
 * Tests for Soroban RPC subscription client:
 * - Active subscriptions
 * - Lapsed subscriptions (renews_at in past)
 * - Never-existed subscriptions (null)
 * - RPC unavailable (fail-closed behavior)
 * - Cache TTL and invalidation
 */

import {
  isSubscriptionActive,
  querySubscriptionOnChain,
  invalidateSubscriptionCache,
  clearSubscriptionCache,
  type OnChainSubscription,
} from "../rpc-client";

// Mock environment
const mockContractId = "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const mockRpcUrl = "https://soroban-rpc.stellar.org";

beforeAll(() => {
  process.env.STREAMFI_SUBSCRIPTION_CONTRACT_ID = mockContractId;
  process.env.SOROBAN_RPC_URL = mockRpcUrl;
});

beforeEach(() => {
  clearSubscriptionCache();
  jest.clearAllMocks();
  // Mock fetch globally
  global.fetch = jest.fn();
});

describe("isSubscriptionActive", () => {
  const subscriber = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1";
  const creator = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2";
  const now = Math.floor(Date.now() / 1000);

  it("returns true for active subscription (not cancelled, renews_at in future)", async () => {
    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 1,
      authorized_at: now - 3600,
      renews_at: now + 86400, // Tomorrow
      amount_stroops: "100000000",
      period_seconds: 2592000, // 30 days
      authorization_expiry: now + 2592000,
      cancelled_at: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { events: [{ subscription }] },
      }),
    });

    const result = await isSubscriptionActive(subscriber, creator, 1000); // 1s TTL for testing
    expect(result).toBe(true);
  });

  it("returns false for lapsed subscription (renews_at in past)", async () => {
    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 1,
      authorized_at: now - 86400,
      renews_at: now - 3600, // Yesterday
      amount_stroops: "100000000",
      period_seconds: 2592000,
      authorization_expiry: now + 2592000,
      cancelled_at: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { events: [{ subscription }] },
      }),
    });

    const result = await isSubscriptionActive(subscriber, creator, 1000);
    expect(result).toBe(false);
  });

  it("returns false for cancelled subscription (cancelled_at is set)", async () => {
    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 1,
      authorized_at: now - 3600,
      renews_at: now + 86400,
      amount_stroops: "100000000",
      period_seconds: 2592000,
      authorization_expiry: now + 2592000,
      cancelled_at: now - 1800, // Cancelled 30 min ago
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { events: [{ subscription }] },
      }),
    });

    const result = await isSubscriptionActive(subscriber, creator, 1000);
    expect(result).toBe(false);
  });

  it("returns false for never-existed subscription (null result)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { events: [] },
      }),
    });

    const result = await isSubscriptionActive(subscriber, creator, 1000);
    expect(result).toBe(false);
  });

  it("returns false on RPC error (fail-closed)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await isSubscriptionActive(subscriber, creator, 1000);
    expect(result).toBe(false);
  });

  it("returns false on RPC network error (fail-closed)", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    const result = await isSubscriptionActive(subscriber, creator, 1000);
    expect(result).toBe(false);
  });

  it("caches result and does not hit RPC on second call within TTL", async () => {
    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 1,
      authorized_at: now - 3600,
      renews_at: now + 86400,
      amount_stroops: "100000000",
      period_seconds: 2592000,
      authorization_expiry: now + 2592000,
      cancelled_at: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { events: [{ subscription }] },
      }),
    });

    // First call
    const result1 = await isSubscriptionActive(subscriber, creator, 10000); // 10s TTL
    expect(result1).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call (should use cache)
    const result2 = await isSubscriptionActive(subscriber, creator, 10000);
    expect(result2).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1); // No new RPC call
  });

  it("invalidates cache and hits RPC again after invalidation", async () => {
    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 1,
      authorized_at: now - 3600,
      renews_at: now + 86400,
      amount_stroops: "100000000",
      period_seconds: 2592000,
      authorization_expiry: now + 2592000,
      cancelled_at: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [{ subscription }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [] }, // Now subscription is gone
        }),
      });

    // First call
    const result1 = await isSubscriptionActive(subscriber, creator, 10000);
    expect(result1).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Invalidate cache
    invalidateSubscriptionCache(subscriber, creator);

    // Second call (should hit RPC again)
    const result2 = await isSubscriptionActive(subscriber, creator, 10000);
    expect(result2).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("expires cache after TTL and hits RPC again", async () => {
    jest.useFakeTimers();

    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 1,
      authorized_at: now - 3600,
      renews_at: now + 86400,
      amount_stroops: "100000000",
      period_seconds: 2592000,
      authorization_expiry: now + 2592000,
      cancelled_at: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [{ subscription }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [] },
        }),
      });

    // First call with 1s TTL
    const result1 = await isSubscriptionActive(subscriber, creator, 1000);
    expect(result1).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance time by 1.5s (past TTL)
    jest.advanceTimersByTime(1500);

    // Second call (cache expired, should hit RPC)
    const result2 = await isSubscriptionActive(subscriber, creator, 1000);
    expect(result2).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it("clears all cache on clearSubscriptionCache()", async () => {
    const sub1 = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3";
    const sub2 = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX4";
    const creator1 = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX5";
    const creator2 = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX6";

    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 1,
      authorized_at: now - 3600,
      renews_at: now + 86400,
      amount_stroops: "100000000",
      period_seconds: 2592000,
      authorization_expiry: now + 2592000,
      cancelled_at: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [{ subscription }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [{ subscription }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [{ subscription }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { events: [{ subscription }] },
        }),
      });

    // Populate cache
    await isSubscriptionActive(sub1, creator1, 10000);
    await isSubscriptionActive(sub2, creator2, 10000);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Clear all cache
    clearSubscriptionCache();

    // Hit RPC again
    await isSubscriptionActive(sub1, creator1, 10000);
    await isSubscriptionActive(sub2, creator2, 10000);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});

describe("querySubscriptionOnChain", () => {
  const subscriber = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1";
  const creator = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2";
  const now = Math.floor(Date.now() / 1000);

  it("returns subscription on successful RPC call", async () => {
    const subscription: OnChainSubscription = {
      subscriber,
      creator,
      tier_id: 2,
      authorized_at: now - 7200,
      renews_at: now + 172800,
      amount_stroops: "200000000",
      period_seconds: 2592000,
      authorization_expiry: now + 5184000,
      cancelled_at: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { events: [{ subscription }] },
      }),
    });

    const result = await querySubscriptionOnChain(subscriber, creator);
    expect(result).toEqual(subscription);
  });

  it("returns null for non-existent subscription", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { events: [] },
      }),
    });

    const result = await querySubscriptionOnChain(subscriber, creator);
    expect(result).toBeNull();
  });

  it("throws on RPC HTTP error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(querySubscriptionOnChain(subscriber, creator)).rejects.toThrow(
      "Soroban RPC error"
    );
  });

  it("throws on RPC JSON-RPC error response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: { code: -32600, message: "Invalid Request" },
      }),
    });

    await expect(querySubscriptionOnChain(subscriber, creator)).rejects.toThrow(
      "Soroban RPC error"
    );
  });

  it("throws on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network unreachable")
    );

    await expect(querySubscriptionOnChain(subscriber, creator)).rejects.toThrow(
      "Network unreachable"
    );
  });

  it("throws if SOROBAN_RPC_URL not configured", async () => {
    delete process.env.SOROBAN_RPC_URL;

    await expect(
      querySubscriptionOnChain(subscriber, creator)
    ).rejects.toThrow("SOROBAN_RPC_URL not configured");

    process.env.SOROBAN_RPC_URL = mockRpcUrl;
  });

  it("throws if STREAMFI_SUBSCRIPTION_CONTRACT_ID not configured", async () => {
    delete process.env.STREAMFI_SUBSCRIPTION_CONTRACT_ID;

    await expect(
      querySubscriptionOnChain(subscriber, creator)
    ).rejects.toThrow("STREAMFI_SUBSCRIPTION_CONTRACT_ID not configured");

    process.env.STREAMFI_SUBSCRIPTION_CONTRACT_ID = mockContractId;
  });
});
