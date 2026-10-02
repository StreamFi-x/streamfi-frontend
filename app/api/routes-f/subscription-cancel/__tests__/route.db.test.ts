/**
 * @jest-environment node
 *
 * Integration coverage for subscription cancellation (#1426) against real
 * PostgreSQL: ownership, idempotency, and the "cancel is renewal-only, access
 * continues to expires_at" semantics.
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
import { POST } from "../route";

jest.setTimeout(30_000);

function req(body: unknown, key = "cancel-key-0001") {
  return new NextRequest("http://localhost/api/routes-f/subscription-cancel", {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

describeWithDb("POST /api/routes-f/subscription-cancel (PostgreSQL)", () => {
  let schema: TestSchema;
  let subscriberId: string;
  let creatorId: string;
  let otherUserId: string;

  beforeEach(async () => {
    schema = await createTestSchema("subcancel");
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
      const o = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('other1', 'GOTHER1') RETURNING id`
      );
      otherUserId = o.rows[0].id;
    } finally {
      await client.end();
    }

    (verifySession as jest.Mock).mockResolvedValue({
      ok: true,
      userId: subscriberId,
    });
  });

  afterEach(async () => {
    await schema.drop();
  });

  async function createActiveSubscription(): Promise<{ id: string; expiresAt: string }> {
    const { rows } = await sql`
      INSERT INTO subscriptions (subscriber_id, creator_id, expires_at, status)
      VALUES (${subscriberId}, ${creatorId}, NOW() + interval '20 days', 'active')
      RETURNING id, expires_at
    `;
    return { id: rows[0].id, expiresAt: rows[0].expires_at };
  }

  it("401s when unauthenticated", async () => {
    (verifySession as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await POST(req({ subscriptionId: "00000000-0000-4000-8000-000000000000" }));
    expect(res.status).toBe(401);
  });

  it("400s on a non-UUID subscriptionId", async () => {
    const res = await POST(req({ subscriptionId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("404s for an unknown subscription", async () => {
    const res = await POST(req({ subscriptionId: "00000000-0000-4000-8000-000000000000" }));
    expect(res.status).toBe(404);
  });

  it("403s when the caller does not own the subscription", async () => {
    const { id } = await createActiveSubscription();
    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: otherUserId });
    const res = await POST(req({ subscriptionId: id }));
    expect(res.status).toBe(403);
  });

  it("cancels renewal and reports access continuing to expires_at", async () => {
    const { id, expiresAt } = await createActiveSubscription();
    const res = await POST(req({ subscriptionId: id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("renewal_cancelled");
    expect(new Date(body.accessUntil).toISOString()).toBe(new Date(expiresAt).toISOString());
    expect(body.alreadyCancelled).toBe(false);

    const { rows } = await sql`SELECT status, renewal_cancelled_at FROM subscriptions WHERE id = ${id}`;
    // Cancellation stops renewal only — status is left as-is, access is untouched.
    expect(rows[0].status).toBe("active");
    expect(rows[0].renewal_cancelled_at).not.toBeNull();
  });

  it("is idempotent: cancelling an already-cancelled subscription reports the same outcome", async () => {
    const { id } = await createActiveSubscription();
    const first = await POST(req({ subscriptionId: id }, "cancel-key-a"));
    expect((await first.json()).alreadyCancelled).toBe(false);

    const second = await POST(req({ subscriptionId: id }, "cancel-key-b"));
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.success).toBe(true);
    expect(body.alreadyCancelled).toBe(true);
  });

  it("does not create contradictory state under concurrent duplicate requests", async () => {
    const { id } = await createActiveSubscription();
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => POST(req({ subscriptionId: id }, `concurrent-key-${i}`)))
    );
    expect(responses.every(r => r.status === 200)).toBe(true);

    const { rows } = await sql`SELECT renewal_cancelled_at FROM subscriptions WHERE id = ${id}`;
    expect(rows[0].renewal_cancelled_at).not.toBeNull();
  });

  it("cancelling near renewal still preserves access through the existing expires_at", async () => {
    const { rows: created } = await sql`
      INSERT INTO subscriptions (subscriber_id, creator_id, expires_at, status)
      VALUES (${subscriberId}, ${creatorId}, NOW() + interval '2 minutes', 'active')
      RETURNING id, expires_at
    `;
    const res = await POST(req({ subscriptionId: created[0].id }));
    const body = await res.json();
    expect(new Date(body.accessUntil).getTime()).toBe(new Date(created[0].expires_at).getTime());
  });

  it("cancelling an already-expired subscription still succeeds and does not revive access", async () => {
    const { rows: created } = await sql`
      INSERT INTO subscriptions (subscriber_id, creator_id, expires_at, status)
      VALUES (${subscriberId}, ${creatorId}, NOW() - interval '1 day', 'expired')
      RETURNING id, expires_at
    `;
    const res = await POST(req({ subscriptionId: created[0].id }));
    expect(res.status).toBe(200);
    const { rows } = await sql`SELECT status FROM subscriptions WHERE id = ${created[0].id}`;
    expect(rows[0].status).toBe("expired");
  });
});
