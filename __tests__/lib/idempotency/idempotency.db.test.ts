/**
 * @jest-environment node
 *
 * #1401 idempotency store and route wrapper against real PostgreSQL.
 */
jest.mock("@vercel/postgres", () => ({ sql: { query: jest.fn() } }));
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { NextResponse } from "next/server";
import { executeIdempotent, OperationContext } from "@/lib/idempotency/execute";
import {
  canonicalJson,
  requestFingerprint,
  validateIdempotencyKey,
} from "@/lib/idempotency/key";
import { purgeExpiredIdempotencyKeys } from "@/lib/idempotency/store";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";

jest.setTimeout(30_000);

describe("idempotency key contract", () => {
  it("requires a key", () => {
    expect(validateIdempotencyKey(null)).toEqual({
      ok: false,
      error: "idempotency_key_required",
    });
    expect(validateIdempotencyKey("  ")).toEqual({
      ok: false,
      error: "idempotency_key_required",
    });
  });

  it("rejects malformed and oversized keys", () => {
    for (const bad of [
      "short",
      "has space in it",
      "x".repeat(256),
      "ключ-ключ-ключ",
    ]) {
      expect(validateIdempotencyKey(bad)).toEqual({
        ok: false,
        error: "idempotency_key_invalid",
      });
    }
  });

  it("accepts UUIDs", () => {
    expect(
      validateIdempotencyKey("0f8fad5b-d9cb-469f-a165-70867728950e").ok
    ).toBe(true);
  });

  it("fingerprints ignore key order but not values or scope", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [1, 2] } })).toBe(
      canonicalJson({ a: { c: [1, 2], d: 2 }, b: 1 })
    );
    expect(requestFingerprint("s", { a: 1 })).not.toBe(
      requestFingerprint("s", { a: 2 })
    );
    expect(requestFingerprint("s", { a: 1 })).not.toBe(
      requestFingerprint("t", { a: 1 })
    );
  });
});

describeWithDb("executeIdempotent (PostgreSQL)", () => {
  let schema: TestSchema;
  const USER_A = "11111111-1111-4111-8111-111111111111";
  const USER_B = "22222222-2222-4222-8222-222222222222";
  const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const OP = { scope: "test.charge", ttlSeconds: 3600, leaseSeconds: 30 };

  beforeEach(async () => {
    schema = await createTestSchema("idempotency");
    await applyAppSchema(schema.pool);
  });

  afterEach(async () => {
    await schema.drop();
  });

  function request(key: string | null = KEY) {
    return new Request("http://localhost/api/charge", {
      method: "POST",
      headers: key === null ? {} : { "Idempotency-Key": key },
    });
  }

  /** A "financial side effect" that inserts a row and counts executions. */
  function charge(delayMs = 0) {
    const calls: OperationContext[] = [];
    const fn = async (ctx: OperationContext) => {
      calls.push(ctx);
      if (delayMs) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      await schema.pool.query(
        "CREATE TABLE IF NOT EXISTS charges (ref UUID, n SERIAL)"
      );
      await schema.pool.query("INSERT INTO charges (ref) VALUES ($1)", [
        ctx.idempotencyRef,
      ]);
      return NextResponse.json(
        { charged: true, ref: ctx.idempotencyRef },
        { status: 201 }
      );
    };
    return { fn, calls };
  }

  function run(
    op: (ctx: OperationContext) => Promise<NextResponse>,
    opts: {
      userId?: string;
      request?: unknown;
      key?: string | null;
      scope?: string;
      wait?: number;
    } = {}
  ) {
    return executeIdempotent(
      request(opts.key === undefined ? KEY : opts.key),
      {
        ...OP,
        scope: opts.scope ?? OP.scope,
        userId: opts.userId ?? USER_A,
        request: opts.request ?? { amount: "10.00" },
        waitForInFlightMs: opts.wait ?? 0,
        executor: poolExecutor(schema.pool),
      },
      op
    );
  }

  async function chargeCount(): Promise<number> {
    const { rows } = await schema.pool.query(
      "SELECT to_regclass('charges') IS NOT NULL AS present"
    );
    if (!rows[0].present) {
      return 0;
    }
    const count = await schema.pool.query(
      "SELECT COUNT(*)::int AS n FROM charges"
    );
    return count.rows[0].n;
  }

  it("runs the operation once and replays the stored response on retry", async () => {
    const { fn, calls } = charge();

    const first = await run(fn);
    const retry = await run(fn);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(await first.json());
    expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
    expect(calls).toHaveLength(1);
    expect(await chargeCount()).toBe(1);
  });

  it("lets exactly one of many concurrent duplicates execute", async () => {
    const { fn, calls } = charge(150);

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => run(fn, { wait: 5_000 }))
    );

    expect(calls).toHaveLength(1);
    expect(await chargeCount()).toBe(1);
    expect(responses.map(r => r.status)).toEqual(Array(20).fill(201));
    const refs = new Set(
      await Promise.all(responses.map(async r => (await r.json()).ref))
    );
    expect(refs.size).toBe(1);
  });

  it("answers 409 in progress when a duplicate cannot wait for the original", async () => {
    const { fn } = charge(300);

    const [original, duplicate] = await Promise.all([
      run(fn),
      new Promise<NextResponse>(resolve =>
        setTimeout(() => resolve(run(fn)), 50)
      ),
    ]);

    expect(original.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe(
      "idempotency_request_in_progress"
    );
    expect(duplicate.headers.get("Retry-After")).toBe("1");
  });

  it("scopes keys per user and per operation type", async () => {
    const { fn, calls } = charge();

    await run(fn, { userId: USER_A });
    await run(fn, { userId: USER_B });
    await run(fn, { scope: "test.other" });

    expect(calls).toHaveLength(3);
    expect(new Set(calls.map(c => c.idempotencyRef)).size).toBe(3);
  });

  it("rejects the same key with a different request", async () => {
    const { fn, calls } = charge();
    await run(fn, { request: { amount: "10.00" } });

    const res = await run(fn, { request: { amount: "99.00" } });

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("idempotency_key_reused");
    expect(calls).toHaveLength(1);
  });

  it("rejects missing, malformed and oversized keys without running anything", async () => {
    const { fn, calls } = charge();
    for (const key of [null, "bad key", "x".repeat(300)]) {
      expect((await run(fn, { key })).status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });

  it("releases the key after a server error so a retry can run", async () => {
    let attempts = 0;
    const flaky = async () => {
      attempts++;
      return attempts === 1
        ? NextResponse.json({ error: "db down" }, { status: 500 })
        : NextResponse.json({ ok: true }, { status: 201 });
    };

    expect((await run(flaky)).status).toBe(500);
    expect((await run(flaky)).status).toBe(201);
    expect(attempts).toBe(2);
  });

  it("releases the key when the operation throws (rolled back work)", async () => {
    const broken = async () => {
      throw new Error("provider exploded");
    };
    await expect(run(broken)).rejects.toThrow("provider exploded");

    const { fn, calls } = charge();
    expect((await run(fn)).status).toBe(201);
    expect(calls).toHaveLength(1);
  });

  it("replays final client errors instead of re-running", async () => {
    let attempts = 0;
    const rejects = async () => {
      attempts++;
      return NextResponse.json(
        { error: "Insufficient USDC balance" },
        { status: 400 }
      );
    };

    await run(rejects);
    const retry = await run(rejects);

    expect(retry.status).toBe(400);
    expect(attempts).toBe(1);
  });

  it("lets one retry take over after the original crashed mid-operation", async () => {
    const { fn: firstAttempt } = charge();
    // Simulate a crash: the side effect ran but the response was never stored.
    await schema.pool.query(
      `INSERT INTO idempotency_keys (user_id, scope, idempotency_key, request_fingerprint,
         status, locked_until, expires_at)
       VALUES ($1, $2, $3, $4, 'processing', NOW() - interval '1 second', NOW() + interval '1 hour')`,
      [USER_A, OP.scope, KEY, requestFingerprint(OP.scope, { amount: "10.00" })]
    );
    const { rows } = await schema.pool.query("SELECT id FROM idempotency_keys");
    await firstAttempt({ idempotencyRef: rows[0].id, recovered: false });

    const seen: OperationContext[] = [];
    const recoverable = async (ctx: OperationContext) => {
      seen.push(ctx);
      const existing = await schema.pool.query(
        "SELECT ref FROM charges WHERE ref = $1",
        [ctx.idempotencyRef]
      );
      if (existing.rows[0]) {
        return NextResponse.json(
          { charged: true, ref: ctx.idempotencyRef },
          { status: 201 }
        );
      }
      throw new Error("would double charge");
    };

    const responses = await Promise.all([run(recoverable), run(recoverable)]);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ idempotencyRef: rows[0].id, recovered: true });
    // The other retry either waits out the takeover (409) or replays its result.
    expect(responses.map(r => r.status)).toContain(201);
    expect(responses.every(r => [201, 409].includes(r.status))).toBe(true);
    expect(await chargeCount()).toBe(1);
  });

  it("an expired completed key starts a new operation", async () => {
    const { fn, calls } = charge();
    await run(fn);
    await schema.pool.query(
      "UPDATE idempotency_keys SET expires_at = NOW() - interval '1 second'"
    );

    await run(fn, { request: { amount: "20.00" } });

    expect(calls).toHaveLength(2);
    expect(calls[0].idempotencyRef).not.toBe(calls[1].idempotencyRef);
  });

  it("an expired key is never reused while its operation may still be running", async () => {
    const { fn, calls } = charge();
    await schema.pool.query(
      `INSERT INTO idempotency_keys (user_id, scope, idempotency_key, request_fingerprint,
         status, locked_until, expires_at)
       VALUES ($1, $2, $3, $4, 'processing', NOW() + interval '1 minute', NOW() - interval '1 second')`,
      [USER_A, OP.scope, KEY, requestFingerprint(OP.scope, { amount: "10.00" })]
    );

    expect((await run(fn)).status).toBe(409);
    expect(calls).toHaveLength(0);
  });

  it("cleanup deletes only expired, finished keys and is repeatable", async () => {
    await schema.pool.query(
      `INSERT INTO idempotency_keys (user_id, scope, idempotency_key, request_fingerprint,
         status, locked_until, expires_at)
       VALUES
         ($1, 's', 'expired-done-key', $2, 'completed', NOW(), NOW() - interval '1 hour'),
         ($1, 's', 'expired-running', $2, 'processing', NOW() + interval '1 minute', NOW() - interval '1 hour'),
         ($1, 's', 'expired-crashed', $2, 'processing', NOW() - interval '1 minute', NOW() - interval '1 hour'),
         ($1, 's', 'live-done-key-1', $2, 'completed', NOW(), NOW() + interval '1 hour')`,
      [USER_A, "0".repeat(64)]
    );
    const exec = poolExecutor(schema.pool);

    expect(await purgeExpiredIdempotencyKeys({ batchSize: 1 }, exec)).toBe(2);
    expect(await purgeExpiredIdempotencyKeys({}, exec)).toBe(0);
    const { rows } = await schema.pool.query(
      "SELECT idempotency_key FROM idempotency_keys ORDER BY idempotency_key"
    );
    expect(rows.map(r => r.idempotency_key)).toEqual([
      "expired-running",
      "live-done-key-1",
    ]);
  });
});
