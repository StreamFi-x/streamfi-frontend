/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET } from "../subscriptions/cancel/route";
import { GET as GET_MAIN, subscriptions } from "../subscriptions/route";

function makePostReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/subscriptions/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetReq(subscriptionId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/subscriptions/cancel?subscription_id=${subscriptionId}`
  );
}

function makeMainGetReq(subscriptionId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/subscriptions?subscription_id=${subscriptionId}`
  );
}

describe("Cancel Subscription API", () => {
  beforeEach(() => {
    subscriptions.clear();
  });

  it("should successfully cancel an active subscription, keeping expires_at intact", async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    subscriptions.set("sub-123", {
      subscription_id: "sub-123",
      subscriber_id: "subscriber-456",
      creator_id: "creator-789",
      tier_id: "premium",
      payment_tx_hash: "hash-xyz",
      asset: "USDC",
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      status: "active",
    });

    const req = makePostReq({
      subscription_id: "sub-123",
      subscriber_id: "subscriber-456",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("cancelled");
    expect(data.expires_at).toBe(expiresAt);

    // Verify GET cancel endpoint returns current state
    const getRes = await GET(makeGetReq("sub-123"));
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.status).toBe("cancelled");
    expect(getData.expires_at).toBe(expiresAt);

    // Verify GET main endpoint also returns current state
    const getMainRes = await GET_MAIN(makeMainGetReq("sub-123"));
    expect(getMainRes.status).toBe(200);
    const getMainData = await getMainRes.json();
    expect(getMainData.status).toBe("cancelled");
  });

  it("should return 403 Forbidden if the requester is not the subscriber", async () => {
    subscriptions.set("sub-123", {
      subscription_id: "sub-123",
      subscriber_id: "subscriber-456",
      creator_id: "creator-789",
      tier_id: "premium",
      payment_tx_hash: "hash-xyz",
      asset: "USDC",
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    });

    const req = makePostReq({
      subscription_id: "sub-123",
      subscriber_id: "subscriber-wrong",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("should handle double-cancel correctly, returning cancelled state", async () => {
    subscriptions.set("sub-123", {
      subscription_id: "sub-123",
      subscriber_id: "subscriber-456",
      creator_id: "creator-789",
      tier_id: "premium",
      payment_tx_hash: "hash-xyz",
      asset: "USDC",
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "cancelled",
    });

    const req = makePostReq({
      subscription_id: "sub-123",
      subscriber_id: "subscriber-456",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("cancelled");
  });
});
