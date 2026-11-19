/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from "next/server";
import { POST } from "../route";
import { resetGiftStore, getInboxForUser, chatGiftEventsStore, subscriptionStore, giftStore } from "../store";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/subscriptions/gift", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  gifter_id: "user_alice",
  recipient_id: "user_bob",
  creator_id: "creator_a",
  tier_id: "tier_silver",
  payment_tx_hash: "0xabc123def456",
};

describe("POST /api/routes-f/subscriptions/gift", () => {
  beforeEach(() => {
    resetGiftStore();
  });

  it("creates a gift subscription and returns gift_id with expiration date", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.gift_id).toBe("string");
    expect(data.gift_id).toMatch(/^gift_/);
    expect(data.recipient_id).toBe("user_bob");
    expect(data.is_stacked).toBe(false);
    expect(data.expires_at).toBeTruthy();

    // Verify separate payer vs recipient attribution
    expect(giftStore[0].gifter_id).toBe("user_alice");
    expect(giftStore[0].recipient_id).toBe("user_bob");
    expect(subscriptionStore[0].subscriber_id).toBe("user_bob");
    expect(subscriptionStore[0].gifted_by).toBe("user_alice");

    // Verify notification was sent
    const inbox = getInboxForUser("user_bob");
    expect(inbox.length).toBe(1);
    expect(inbox[0].type).toBe("gift_subscription");

    // Verify chat event was emitted
    expect(chatGiftEventsStore.length).toBe(1);
    expect(chatGiftEventsStore[0].gifter_id).toBe("user_alice");
    expect(chatGiftEventsStore[0].recipient_id).toBe("user_bob");
  });

  it("stacks and extends expiration when recipient already has an active subscription", async () => {
    // First gift
    const res1 = await POST(makeReq(validBody));
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    const firstExpiresAt = new Date(data1.expires_at).getTime();

    // Second gift from another user or same user
    const res2 = await POST(
      makeReq({
        ...validBody,
        gifter_id: "user_charlie",
        payment_tx_hash: "0xsecondtxhash",
      })
    );
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.is_stacked).toBe(true);

    const secondExpiresAt = new Date(data2.expires_at).getTime();
    // The second expiration should be extended by approximately 30 days beyond the first
    const expectedDiffMs = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(secondExpiresAt - firstExpiresAt - expectedDiffMs)).toBeLessThan(5000);
  });

  it("allows bulk gifting subscriptions to community members", async () => {
    const res = await POST(
      makeReq({
        gifter_id: "user_alice",
        creator_id: "creator_a",
        tier_id: "tier_bronze",
        payment_tx_hash: "0xbulktxhash",
        is_bulk: true,
        bulk_count: 3,
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.bulk_gifts).toHaveLength(3);
    expect(data.message).toContain("3 subscriptions");

    // Check chat announcement for bulk
    const lastChat = chatGiftEventsStore[chatGiftEventsStore.length - 1];
    expect(lastChat.is_bulk).toBe(true);
    expect(lastChat.bulk_count).toBe(3);
  });

  it("allows gifting to a non-existing user (creates them)", async () => {
    const res = await POST(
      makeReq({ ...validBody, recipient_id: "brand_new_user_xyz" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.gift_id).toBeTruthy();
  });

  it("returns 400 when gifter_id is missing", async () => {
    const { gifter_id: _gifter_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipient_id is missing in single gift mode", async () => {
    const { recipient_id: _recipient_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const { creator_id: _creator_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tier_id is missing", async () => {
    const { tier_id: _tier_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payment_tx_hash is missing", async () => {
    const { payment_tx_hash: _payment_tx_hash, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when gifter and recipient are the same", async () => {
    const res = await POST(
      makeReq({ ...validBody, recipient_id: validBody.gifter_id })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/different/i);
  });

  it("returns 404 for unknown creator", async () => {
    const res = await POST(
      makeReq({ ...validBody, creator_id: "creator_unknown" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid tier on a known creator", async () => {
    const res = await POST(
      makeReq({ ...validBody, tier_id: "tier_not_real" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/tier/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/subscriptions/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
