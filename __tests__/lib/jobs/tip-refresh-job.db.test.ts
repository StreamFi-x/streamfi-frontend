/**
 * @jest-environment node
 *
 * End to end on real PostgreSQL: the tip reconciliation jobs running through
 * the background job executor (#1416) with a degraded Horizon (#1418).
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));
jest.mock("@/lib/tracing/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/security/alerts", () => ({
  sendOperationalAlert: jest.fn().mockResolvedValue("logged"),
}));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { createTipRefreshJob } from "@/lib/jobs/definitions/tip-reconciliation";
import { executeJob } from "@/lib/jobs/execute";
import { DownstreamTimeoutError } from "@/lib/resilience/circuit-breaker";
import type { LedgerTip } from "@/lib/stellar/tip-reconciliation";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";

jest.setTimeout(30_000);

const WALLET = `G${"CREATOR".padEnd(55, "A")}`;

function records(count: number): LedgerTip[] {
  return Array.from({ length: count }, (_, i) => ({
    sender: `G${"FAN".padEnd(55, "A")}`,
    amount: "1",
    txHash: `tx${i}`,
    timestamp: "2026-09-01T00:00:00Z",
  }));
}

describeWithDb("tip-refresh-creator job (PostgreSQL)", () => {
  let schema: TestSchema;
  let creator: string;

  beforeEach(async () => {
    schema = await createTestSchema("tipjob");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);
    const { rows } = await schema.pool.query(
      `INSERT INTO users (username, wallet) VALUES ('creator', $1) RETURNING id`,
      [WALLET]
    );
    creator = rows[0].id;
  });

  afterEach(async () => {
    await schema.drop();
  });

  async function totals() {
    const { rows } = await schema.pool.query(
      `SELECT total_tips_received::text AS total, total_tips_count AS count
         FROM users WHERE id = $1`,
      [creator]
    );
    return rows[0];
  }

  it("retries through a Horizon outage, resumes at the checkpoint and finishes", async () => {
    const ledger = records(5);
    let outage = true;
    const fetchPayments = jest.fn(async ({ cursor }: { cursor?: string }) => {
      const start = cursor ? Number(cursor) : 0;
      if (outage && start >= 2) {
        throw new DownstreamTimeoutError("horizon", 8_000);
      }
      const page = ledger.slice(start, start + 2);
      return {
        tips: page,
        nextCursor: page.length ? String(start + page.length) : undefined,
      };
    });
    const job = createTipRefreshJob({
      executor: poolExecutor(schema.pool),
      fetchPayments,
      getXlmUsdPrice: async () => 0.1,
    });
    const deps = { executor: poolExecutor(schema.pool), dispatch: jest.fn() };

    // Attempt 1: first page lands, then Horizon times out.
    const first = await executeJob(
      job,
      { userId: creator },
      { trigger: "qstash", messageId: "msg-1", retried: 0 },
      deps
    );
    expect(first).toMatchObject({ httpStatus: 500, status: "retry" });
    expect(await totals()).toEqual({ total: "0.0000000", count: 0 });

    // Attempt 2 (QStash retry, same message): Horizon is back.
    outage = false;
    fetchPayments.mockClear();
    const second = await executeJob(
      job,
      { userId: creator },
      { trigger: "qstash", messageId: "msg-1", retried: 1 },
      deps
    );

    expect(second).toMatchObject({
      httpStatus: 200,
      status: "succeeded",
      attempt: 2,
    });
    expect(fetchPayments.mock.calls[0][0].cursor).toBe("2");
    expect(await totals()).toEqual({ total: "5.0000000", count: 5 });
    const { rows } = await schema.pool.query(
      "SELECT COUNT(*)::int AS n FROM tip_transactions"
    );
    expect(rows[0].n).toBe(5);
  });

  it("queues exactly one continuation per checkpoint when the history is long", async () => {
    const ledger = records(200);
    const fetchPayments = jest.fn(async ({ cursor }: { cursor?: string }) => {
      const start = cursor ? Number(cursor) : 0;
      const page = ledger.slice(start, start + 2);
      return {
        tips: page,
        nextCursor: page.length ? String(start + page.length) : undefined,
      };
    });
    const dispatch = jest
      .fn()
      .mockResolvedValue({ dispatched: true, messageId: "next" });
    const job = createTipRefreshJob({
      executor: poolExecutor(schema.pool),
      fetchPayments,
    });

    const execution = await executeJob(
      job,
      { userId: creator },
      { trigger: "qstash", messageId: "msg-1", retried: 0 },
      { executor: poolExecutor(schema.pool), dispatch }
    );

    expect(execution.status).toBe("succeeded");
    // 50 pages of 2 records per delivery.
    expect(dispatch).toHaveBeenCalledWith(
      job,
      { userId: creator },
      { deduplicationId: `tip-refresh-creator:${creator}:100` }
    );
    expect(await totals()).toEqual({ total: "0.0000000", count: 0 });
  });

  it("dead-letters a delivery for a creator that no longer exists", async () => {
    const job = createTipRefreshJob({ executor: poolExecutor(schema.pool) });
    const execution = await executeJob(
      job,
      { userId: "00000000-0000-4000-8000-000000000000" },
      { trigger: "qstash", messageId: "msg-x", retried: 0 },
      { executor: poolExecutor(schema.pool) }
    );
    expect(execution).toMatchObject({
      httpStatus: 200,
      status: "dead_lettered",
    });
  });

  it("rejects a payload that is not a creator id without running anything", async () => {
    const fetchPayments = jest.fn();
    const job = createTipRefreshJob({
      executor: poolExecutor(schema.pool),
      fetchPayments,
    });
    const execution = await executeJob(
      job,
      { userId: "'; DROP TABLE users; --" },
      { trigger: "qstash", messageId: "msg-y", retried: 0 },
      { executor: poolExecutor(schema.pool) }
    );
    expect(execution.status).toBe("dead_lettered");
    expect(fetchPayments).not.toHaveBeenCalled();
  });
});
