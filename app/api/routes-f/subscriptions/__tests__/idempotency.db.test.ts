/**
 * @jest-environment node
 *
 * Subscription purchase/renewal duplicate prevention (#1401) with the real
 * PostgreSQL idempotency store.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
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
import { POST as purchase, subscriptions } from "../route";
import { POST as renew } from "../../subscription-renew-confirm/route";

jest.setTimeout(30_000);

const SUBSCRIBER = "a1b2c3d4-0000-4000-8000-000000000001";
const CREATOR = "a1b2c3d4-0000-4000-8000-000000000002";

function req(url: string, body: unknown, key: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

const PURCHASE = {
  subscriber_id: SUBSCRIBER,
  creator_id: CREATOR,
  tier_id: "basic",
  payment_tx_hash: "tx-purchase",
  asset: "XLM",
};

describeWithDb("subscription idempotency (PostgreSQL)", () => {
  let schema: TestSchema;

  beforeEach(async () => {
    schema = await createTestSchema("subs");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);
    subscriptions.clear();
    (verifySession as jest.Mock).mockResolvedValue({
      ok: true,
      userId: SUBSCRIBER,
    });
  });

  afterEach(async () => {
    await schema.drop();
  });

  it("concurrent retries of one purchase create a single subscription", async () => {
    const key = "purchase-key-0001";
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        purchase(req("/api/routes-f/subscriptions", PURCHASE, key))
      )
    );

    expect(subscriptions.size).toBe(1);
    const ids = new Set(
      await Promise.all(
        responses
          .filter(r => r.status === 201)
          .map(async r => (await r.json()).subscription_id)
      )
    );
    expect(ids.size).toBe(1);
    expect(responses.every(r => r.status === 201 || r.status === 409)).toBe(
      true
    );
  });

  it("a renewal retried with the same key extends the subscription once", async () => {
    const created = await (
      await purchase(
        req("/api/routes-f/subscriptions", PURCHASE, "purchase-key-0002")
      )
    ).json();
    const body = {
      subscription_id: created.subscription_id,
      payment_tx_hash: "tx-renew",
    };

    const first = await renew(
      req("/api/routes-f/subscription-renew-confirm", body, "renew-key-00001")
    );
    const retry = await renew(
      req("/api/routes-f/subscription-renew-confirm", body, "renew-key-00001")
    );

    expect(first.status).toBe(201);
    expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
    expect((await retry.json()).new_subscription_id).toBe(
      (await first.json()).new_subscription_id
    );
    expect(subscriptions.size).toBe(2);
  });

  it("a renewal resent with a new key is refused instead of applied twice", async () => {
    const created = await (
      await purchase(
        req("/api/routes-f/subscriptions", PURCHASE, "purchase-key-0003")
      )
    ).json();
    const body = {
      subscription_id: created.subscription_id,
      payment_tx_hash: "tx-renew-2",
    };

    await renew(
      req("/api/routes-f/subscription-renew-confirm", body, "renew-key-00002")
    );
    const again = await renew(
      req("/api/routes-f/subscription-renew-confirm", body, "renew-key-00003")
    );

    expect(again.status).toBe(409);
    expect(subscriptions.size).toBe(2);
  });

  it("users cannot renew someone else's subscription", async () => {
    const created = await (
      await purchase(
        req("/api/routes-f/subscriptions", PURCHASE, "purchase-key-0004")
      )
    ).json();
    (verifySession as jest.Mock).mockResolvedValue({
      ok: true,
      userId: CREATOR,
    });

    const res = await renew(
      req(
        "/api/routes-f/subscription-renew-confirm",
        { subscription_id: created.subscription_id, payment_tx_hash: "tx-x" },
        "renew-key-00004"
      )
    );

    expect(res.status).toBe(404);
  });
});
