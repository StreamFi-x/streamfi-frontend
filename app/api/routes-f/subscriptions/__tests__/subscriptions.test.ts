/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, subscriptions } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_SUBSCRIBER = "a1b2c3d4-0000-4000-8000-000000000001";
const VALID_CREATOR = "a1b2c3d4-0000-4000-8000-000000000002";
const OTHER_CREATOR = "a1b2c3d4-0000-4000-8000-000000000003";

describe("POST /api/routes-f/subscriptions", () => {
  beforeEach(() => {
    // Reset in-memory store before each test so tests are independent.
    subscriptions.clear();
  });

  it("201 — creates a new subscription for a valid tier", async () => {
    const res = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "basic",
        payment_tx_hash: "abc123tx",
        asset: "XLM",
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.subscription_id).toBeTruthy();
    expect(body.subscriber_id).toBe(VALID_SUBSCRIBER);
    expect(body.creator_id).toBe(VALID_CREATOR);
    expect(body.tier_id).toBe("basic");
    expect(body.started_at).toBeTruthy();
    expect(body.expires_at).toBeTruthy();

    // expires_at should be ~30 days after started_at
    const started = new Date(body.started_at).getTime();
    const expires = new Date(body.expires_at).getTime();
    const diffDays = (expires - started) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it("201 — standard tier gives ~90 days and premium gives ~365 days", async () => {
    const resStd = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "standard",
        payment_tx_hash: "tx_std",
        asset: "USDC",
      })
    );
    expect(resStd.status).toBe(201);
    const bodyStd = await resStd.json();
    const diffStd =
      (new Date(bodyStd.expires_at).getTime() -
        new Date(bodyStd.started_at).getTime()) /
      (24 * 60 * 60 * 1000);
    expect(diffStd).toBeCloseTo(90, 0);

    // Clear store then test premium.
    subscriptions.clear();

    const resPrem = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "premium",
        payment_tx_hash: "tx_prem",
        asset: "XLM",
      })
    );
    expect(resPrem.status).toBe(201);
    const bodyPrem = await resPrem.json();
    const diffPrem =
      (new Date(bodyPrem.expires_at).getTime() -
        new Date(bodyPrem.started_at).getTime()) /
      (24 * 60 * 60 * 1000);
    expect(diffPrem).toBeCloseTo(365, 0);
  });

  it("409 — duplicate active subscription for same subscriber+creator", async () => {
    // First subscribe
    await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "basic",
        payment_tx_hash: "tx_first",
        asset: "XLM",
      })
    );

    // Same subscriber to same creator again
    const res = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "standard",
        payment_tx_hash: "tx_second",
        asset: "USDC",
      })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already active/i);
    expect(body.subscription_id).toBeTruthy();
    expect(body.expires_at).toBeTruthy();
  });

  it("409 — does NOT block subscription to a different creator", async () => {
    // Subscribe to VALID_CREATOR
    await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "basic",
        payment_tx_hash: "tx_one",
        asset: "XLM",
      })
    );

    // Subscribe to OTHER_CREATOR — should succeed
    const res = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: OTHER_CREATOR,
        tier_id: "basic",
        payment_tx_hash: "tx_two",
        asset: "XLM",
      })
    );

    expect(res.status).toBe(201);
  });

  it("404 — unknown tier_id", async () => {
    const res = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "gold",
        payment_tx_hash: "tx_unknown",
        asset: "XLM",
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/unknown tier/i);
  });

  it("400 — missing required field: subscriber_id", async () => {
    const res = await POST(
      makeReq({
        creator_id: VALID_CREATOR,
        tier_id: "basic",
        payment_tx_hash: "tx_x",
        asset: "XLM",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("400 — missing required field: creator_id", async () => {
    const res = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        tier_id: "basic",
        payment_tx_hash: "tx_x",
        asset: "XLM",
      })
    );
    expect(res.status).toBe(400);
  });

  it("400 — missing required field: payment_tx_hash", async () => {
    const res = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "basic",
        asset: "XLM",
      })
    );
    expect(res.status).toBe(400);
  });

  it("400 — invalid asset value", async () => {
    const res = await POST(
      makeReq({
        subscriber_id: VALID_SUBSCRIBER,
        creator_id: VALID_CREATOR,
        tier_id: "basic",
        payment_tx_hash: "tx_x",
        asset: "BTC",
      })
    );
    expect(res.status).toBe(400);
  });

  it("400 — subscriber_id not a UUID", async () => {
    const res = await POST(
      makeReq({
        subscriber_id: "not-a-uuid",
        creator_id: VALID_CREATOR,
        tier_id: "basic",
        payment_tx_hash: "tx_x",
        asset: "XLM",
      })
    );
    expect(res.status).toBe(400);
  });
});
