/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../subscriptions/badges/route";
import { subscriptions } from "../subscriptions/route";

function makeReq(creatorId: string, subscriberId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/subscriptions/badges?creator_id=${creatorId}&subscriber_id=${subscriberId}`
  );
}

describe("Subscription Badges by Tier API", () => {
  beforeEach(() => {
    subscriptions.clear();
  });

  it("should return has_sub false if no subscription exists", async () => {
    const req = makeReq("creator-1", "user-1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.has_sub).toBe(false);
    expect(data.months_subscribed).toBe(0);
    expect(data.tier_id).toBeUndefined();
  });

  it("should return active subscription details (single tier)", async () => {
    const creatorId = "creator-1";
    const subscriberId = "user-1";

    const now = Date.now();
    // 30 days active sub
    subscriptions.set("sub-1", {
      subscription_id: "sub-1",
      subscriber_id: subscriberId,
      creator_id: creatorId,
      tier_id: "premium",
      payment_tx_hash: "hash-1",
      asset: "USDC",
      started_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const req = makeReq(creatorId, subscriberId);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.has_sub).toBe(true);
    expect(data.tier_id).toBe("premium");
    expect(data.badge_url).toBe("/api/routes-f/subscriptions/badges/svg");
    expect(data.months_subscribed).toBe(1); // 30 days total
  });

  it("should stack months_subscribed across non-overlapping historical subscriptions", async () => {
    const creatorId = "creator-1";
    const subscriberId = "user-1";
    const now = Date.now();

    // Sub 1: Active premium sub (30 days, from now-15d to now+15d)
    subscriptions.set("sub-1", {
      subscription_id: "sub-1",
      subscriber_id: subscriberId,
      creator_id: creatorId,
      tier_id: "premium",
      payment_tx_hash: "hash-1",
      asset: "USDC",
      started_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Sub 2: Past basic sub (30 days, from now-75d to now-45d)
    subscriptions.set("sub-2", {
      subscription_id: "sub-2",
      subscriber_id: subscriberId,
      creator_id: creatorId,
      tier_id: "basic",
      payment_tx_hash: "hash-2",
      asset: "XLM",
      started_at: new Date(now - 75 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Sub 3: Even older basic sub (60 days, from now-150d to now-90d)
    subscriptions.set("sub-3", {
      subscription_id: "sub-3",
      subscriber_id: subscriberId,
      creator_id: creatorId,
      tier_id: "basic",
      payment_tx_hash: "hash-3",
      asset: "XLM",
      started_at: new Date(now - 150 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const req = makeReq(creatorId, subscriberId);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.has_sub).toBe(true);
    expect(data.tier_id).toBe("premium"); // Returns current active tier
    expect(data.months_subscribed).toBe(4); // 30 + 30 + 60 = 120 days -> 4 months
  });

  it("should not double count overlapping subscription days", async () => {
    const creatorId = "creator-1";
    const subscriberId = "user-1";
    const now = Date.now();

    // Sub 1: 30 days
    subscriptions.set("sub-1", {
      subscription_id: "sub-1",
      subscriber_id: subscriberId,
      creator_id: creatorId,
      tier_id: "premium",
      payment_tx_hash: "hash-1",
      asset: "USDC",
      started_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Sub 2: Overlapping (starts 5 days into sub-1, runs for 30 days)
    subscriptions.set("sub-2", {
      subscription_id: "sub-2",
      subscriber_id: subscriberId,
      creator_id: creatorId,
      tier_id: "premium",
      payment_tx_hash: "hash-2",
      asset: "USDC",
      started_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const req = makeReq(creatorId, subscriberId);
    const res = await GET(req);
    const data = await res.json();

    // Total interval: now-15 to now+20 (35 days total) -> Math.floor(35/30) = 1 month
    expect(data.months_subscribed).toBe(1);
  });
});
