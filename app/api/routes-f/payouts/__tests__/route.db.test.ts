/**
 * @jest-environment node
 *
 * Payout trigger duplicate prevention (#1401) against real PostgreSQL.
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
jest.mock("@/lib/routes-f/payouts", () => ({
  ...jest.requireActual("@/lib/routes-f/payouts"),
  getUsdcBalance: jest.fn(),
  sendPayoutConfirmationEmail: jest.fn(),
  notifyAdminOfPayout: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { requestFingerprint } from "@/lib/idempotency/key";
import {
  getUsdcBalance,
  notifyAdminOfPayout,
  sendPayoutConfirmationEmail,
} from "@/lib/routes-f/payouts";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";
import { POST } from "../route";

jest.setTimeout(30_000);

const balance = getUsdcBalance as jest.Mock;
const KEY = "5c3e1d8a-7b8e-4c52-9f3b-2f4a6c1d9e07";
const BODY = {
  amount_usdc: 10,
  method: "stellar_wallet",
  destination: "GDEST",
};

describeWithDb("POST /api/routes-f/payouts (PostgreSQL)", () => {
  let schema: TestSchema;
  let userId: string;

  beforeEach(async () => {
    schema = await createTestSchema("payouts");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);
    const { rows } = await schema.pool.query(
      `INSERT INTO users (username, wallet, email) VALUES ('creator', 'GCREATOR', 'c@example.com') RETURNING id`
    );
    userId = rows[0].id;
    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId });
    balance.mockReset().mockResolvedValue(100);
    (sendPayoutConfirmationEmail as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined);
    (notifyAdminOfPayout as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await schema.drop();
  });

  function post(body: unknown = BODY, key: string | null = KEY) {
    return POST(
      new NextRequest("http://localhost/api/routes-f/payouts", {
        method: "POST",
        headers: key ? { "Idempotency-Key": key } : {},
        body: JSON.stringify(body),
      })
    );
  }

  async function payoutCount(): Promise<number> {
    const { rows } = await schema.pool.query(
      "SELECT COUNT(*)::int AS n FROM payouts"
    );
    return rows[0].n;
  }

  it("creates exactly one payout for many concurrent retries of one request", async () => {
    balance.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 100;
    });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => post())
    );

    expect(await payoutCount()).toBe(1);
    expect(balance).toHaveBeenCalledTimes(1);
    expect(sendPayoutConfirmationEmail).toHaveBeenCalledTimes(1);
    const statuses = responses.map(r => r.status);
    expect(statuses.every(s => s === 201 || s === 409)).toBe(true);
    const ids = new Set(
      await Promise.all(
        responses
          .filter(r => r.status === 201)
          .map(async r => (await r.json()).payout.id)
      )
    );
    expect(ids.size).toBe(1);
  });

  it("replays the original payout on a later retry", async () => {
    const first = await (await post()).json();
    const retry = await post();

    expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
    expect((await retry.json()).payout.id).toBe(first.payout.id);
    expect(await payoutCount()).toBe(1);
  });

  it("does not turn a recorded payout into an error when email fails", async () => {
    (sendPayoutConfirmationEmail as jest.Mock).mockRejectedValue(
      new Error("smtp down")
    );

    const res = await post();
    const retry = await post();

    expect(res.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(await payoutCount()).toBe(1);
  });

  it("recovers the original payout when the first attempt crashed before storing its response", async () => {
    const { rows } = await schema.pool.query(
      `INSERT INTO idempotency_keys (user_id, scope, idempotency_key, request_fingerprint,
         status, locked_until, expires_at)
       VALUES ($1, 'payout.create', $2, $3, 'processing', NOW() - interval '1 second', NOW() + interval '7 days')
       RETURNING id`,
      [
        userId,
        KEY,
        requestFingerprint("payout.create", {
          amount_usdc: "10.00",
          method: "stellar_wallet",
          destination: "GDEST",
        }),
      ]
    );
    const crashed = await schema.pool.query(
      `INSERT INTO payouts (user_id, amount_usdc, method, destination, status, provider,
         fee_usdc, net_usdc, idempotency_ref)
       VALUES ($1, 10, 'stellar_wallet', 'GDEST', 'pending', 'manual', 0, 10, $2) RETURNING id`,
      [userId, rows[0].id]
    );

    const res = await post();

    expect(res.status).toBe(201);
    expect((await res.json()).payout.id).toBe(crashed.rows[0].id);
    expect(await payoutCount()).toBe(1);
    expect(sendPayoutConfirmationEmail).not.toHaveBeenCalled();
  });

  it("counts pending payouts against the balance for new requests", async () => {
    balance.mockResolvedValue(25);

    expect((await post(BODY, "key-one-aaaaaaaa")).status).toBe(201);
    expect((await post(BODY, "key-two-bbbbbbbb")).status).toBe(201);
    const third = await post(BODY, "key-three-cccccc");

    expect(third.status).toBe(400);
    expect((await third.json()).error).toBe("Insufficient USDC balance");
    expect(await payoutCount()).toBe(2);
  });

  it("rejects the same key reused for a different amount", async () => {
    await post();
    const res = await post({ ...BODY, amount_usdc: 50 });

    expect(res.status).toBe(422);
    expect(await payoutCount()).toBe(1);
  });

  it("requires an Idempotency-Key", async () => {
    const res = await post(BODY, null);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("idempotency_key_required");
    expect(await payoutCount()).toBe(0);
  });

  it("frees the key when the payout could not be recorded, so a retry succeeds", async () => {
    balance.mockRejectedValueOnce(new Error("horizon down"));

    expect((await post()).status).toBe(500);
    expect((await post()).status).toBe(201);
    expect(await payoutCount()).toBe(1);
  });

  it("requires authentication", async () => {
    (verifySession as jest.Mock).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await post()).status).toBe(401);
  });
});
