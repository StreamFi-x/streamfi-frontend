import { NextRequest } from "next/server";
import { POST } from "../route";

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
  it("creates a gift subscription and returns gift_id", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.gift_id).toBe("string");
    expect(data.gift_id).toMatch(/^gift_/);
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
    const { gifter_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipient_id is missing", async () => {
    const { recipient_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const { creator_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tier_id is missing", async () => {
    const { tier_id, ...body } = validBody;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payment_tx_hash is missing", async () => {
    const { payment_tx_hash, ...body } = validBody;
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
