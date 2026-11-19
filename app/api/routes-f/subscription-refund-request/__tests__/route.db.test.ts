/**
 * @jest-environment node
 *
 * Integration coverage for subscription refund requests (#1426): eligibility,
 * duplicate prevention, and the payout-already-occurred path.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/tracing/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { sql } from "@vercel/postgres";
import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";
import { GET, POST } from "../route";

jest.setTimeout(30_000);

function postReq(body: unknown, key: string) {
  return new NextRequest(
    "http://localhost/api/routes-f/subscription-refund-request",
    {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(body),
    }
  );
}

function getReq(subscriptionId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/subscription-refund-request?subscriptionId=${subscriptionId}`
  );
}

describeWithDb("subscription-refund-request (PostgreSQL)", () => {
  let schema: TestSchema;
  let subscriberId: string;
  let creatorId: string;

  beforeEach(async () => {
    schema = await createTestSchema("refundreq");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);

    const client = await schema.connect();
    try {
      const s = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('subscriber1', 'GSUB1') RETURNING id`
      );
      subscriberId = s.rows[0].id;
      const c = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('creator1', 'GCREATOR1') RETURNING id`
      );
      creatorId = c.rows[0].id;
    } finally {
      await client.end();
    }

    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: subscriberId });
  });

  afterEach(async () => {
    await schema.drop();
  });

  async function createSubscription(startedDaysAgo: number): Promise<string> {
    const { rows } = await sql`
      INSERT INTO subscriptions (subscriber_id, creator_id, started_at, expires_at, status, payment_tx_hash, amount_usdc)
      VALUES (
        ${subscriberId}, ${creatorId},
        NOW() - (${startedDaysAgo} || ' days')::interval,
        NOW() + interval '10 days', 'active', 'tx_abc', 9.99
      )
      RETURNING id
    `;
    return rows[0].id;
  }

  it("auto-approves a request within the window when no payout has occurred", async () => {
    const subId = await createSubscription(1);
    const res = await POST(postReq({ subscriptionId: subId, reason: "changed my mind about this" }, "refund-request-key-1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("approved");
    expect(body.autoApproved).toBe(true);
    expect(body.fundingSource).toBe("creator_earnings");
  });

  it("routes to manual review when outside the refund window", async () => {
    const subId = await createSubscription(10);
    const res = await POST(postReq({ subscriptionId: subId, reason: "requesting this refund late" }, "refund-request-key-2"));
    const body = await res.json();
    expect(body.status).toBe("pending_review");
    expect(body.autoApproved).toBe(false);
    expect(body.withinWindow).toBe(false);
  });

  it("routes to manual review and platform funding when a creator payout already occurred", async () => {
    const subId = await createSubscription(1);
    await sql`
      INSERT INTO payouts (user_id, amount_usdc, method, destination, status, net_usdc, initiated_at)
      VALUES (${creatorId}, 50, 'stellar_wallet', 'GDEST', 'completed', 50, NOW())
    `;

    const res = await POST(postReq({ subscriptionId: subId, reason: "payout already happened here" }, "refund-request-key-3"));
    const body = await res.json();
    expect(body.status).toBe("pending_review");
    expect(body.payoutOccurred).toBe(true);
    expect(body.fundingSource).toBe("platform");
    expect(body.autoApproved).toBe(false);
  });

  it("does not treat a payout that predates the subscription as blocking auto-approval", async () => {
    const subId = await createSubscription(1);
    await sql`
      INSERT INTO payouts (user_id, amount_usdc, method, destination, status, net_usdc, initiated_at)
      VALUES (${creatorId}, 50, 'stellar_wallet', 'GDEST', 'completed', 50, NOW() - interval '30 days')
    `;
    const res = await POST(postReq({ subscriptionId: subId, reason: "should still auto approve here" }, "refund-request-key-4"));
    const body = await res.json();
    expect(body.autoApproved).toBe(true);
  });

  it("rejects a second refund request for the same subscription (409)", async () => {
    const subId = await createSubscription(1);
    await POST(postReq({ subscriptionId: subId, reason: "first request for this refund" }, "refund-request-key-5"));
    const second = await POST(postReq({ subscriptionId: subId, reason: "trying again right here" }, "refund-request-key-6"));
    expect(second.status).toBe(409);
  });

  it("403s when the caller does not own the subscription", async () => {
    const subId = await createSubscription(1);
    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: creatorId });
    const res = await POST(postReq({ subscriptionId: subId, reason: "not my subscription at all" }, "refund-request-key-7"));
    expect(res.status).toBe(403);
  });

  it("404s for an unknown subscription", async () => {
    const res = await POST(
      postReq(
        { subscriptionId: "00000000-0000-4000-8000-000000000000", reason: "does not exist anywhere" },
        "refund-request-key-8"
      )
    );
    expect(res.status).toBe(404);
  });

  it("400s on a too-short reason", async () => {
    const subId = await createSubscription(1);
    const res = await POST(postReq({ subscriptionId: subId, reason: "no" }, "refund-request-key-9"));
    expect(res.status).toBe(400);
  });

  it("GET returns the request status to its owner", async () => {
    const subId = await createSubscription(1);
    await POST(postReq({ subscriptionId: subId, reason: "checking status afterward" }, "refund-request-key-10"));
    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: subscriberId });
    const res = await GET(getReq(subId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe("approved");
  });

  it("GET returns null when no request exists yet", async () => {
    const subId = await createSubscription(1);
    const res = await GET(getReq(subId));
    const body = await res.json();
    expect(body.request).toBeNull();
  });

  it("GET 403s for a non-owner", async () => {
    const subId = await createSubscription(1);
    await POST(postReq({ subscriptionId: subId, reason: "owner files this request" }, "refund-request-key-11"));
    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: creatorId });
    const res = await GET(getReq(subId));
    expect(res.status).toBe(403);
  });

  it("concurrent duplicate requests result in exactly one row", async () => {
    const subId = await createSubscription(1);
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        POST(postReq({ subscriptionId: subId, reason: "racing duplicate request" }, `race-key-000${i}`))
      )
    );
    const created = responses.filter(r => r.status === 201);
    const conflicted = responses.filter(r => r.status === 409);
    expect(created.length).toBe(1);
    expect(conflicted.length).toBe(4);

    const { rows } = await sql`SELECT COUNT(*)::int AS n FROM subscription_refund_requests WHERE subscription_id = ${subId}`;
    expect(rows[0].n).toBe(1);
  });
});
