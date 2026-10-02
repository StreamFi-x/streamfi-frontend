/**
 * @jest-environment node
 *
 * Tip total reconciliation (#1400, #1418) against real PostgreSQL: the
 * resumable ledger walk, its consistency under partial failure and
 * concurrency, and the scheduled job built on it.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));
jest.mock("@/lib/notifications", () => ({ writeNotification: jest.fn() }));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { NextRequest } from "next/server";
import {
  CircuitBreaker,
  CircuitOpenError,
  DownstreamTimeoutError,
} from "@/lib/resilience/circuit-breaker";
import { createMemoryBreakerStore } from "@/lib/resilience/breaker-store";
import {
  FetchPayments,
  LedgerTip,
  reconcileStaleTipTotals,
  reconcileUserTipTotals,
} from "@/lib/stellar/tip-reconciliation";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";
import { POST as paymentWebhook } from "@/app/api/routes-f/webhooks-stellar-payment/route";

jest.setTimeout(30_000);

function wallet(seed: string): string {
  const base32 = seed
    .toUpperCase()
    .replace(/0/g, "Q")
    .replace(/1/g, "R")
    .replace(/8/g, "S")
    .replace(/9/g, "T")
    .replace(/[^A-Z2-7]/g, "A");
  return `G${base32.padEnd(55, "A")}`;
}

function tip(amount: string, hash: string, sender = wallet("fan")): LedgerTip {
  return {
    sender,
    amount,
    txHash: hash,
    timestamp: `2026-09-0${(hash.length % 9) + 1}T00:00:00Z`,
  };
}

function tips(count: number, prefix = "t"): LedgerTip[] {
  return Array.from({ length: count }, (_, i) =>
    tip(String(i + 1), `${prefix}${i}`)
  );
}

interface LedgerOptions {
  pageSize?: number;
  /** Throws this error for the n-th call (1-based). */
  failOn?: Record<number, Error>;
  /** Runs before a call returns; may change `records`. */
  before?: (cursor: string | undefined, call: number) => Promise<void>;
}

/**
 * Horizon stand-in: pages through `records` oldest first, the cursor being
 * the index after the page's last record, and returns an empty page at the
 * end. `records` may grow during a walk, like the real ledger.
 */
function ledger(records: LedgerTip[], options: LedgerOptions = {}) {
  const size = options.pageSize ?? 2;
  let call = 0;
  return jest.fn(async ({ cursor }: { cursor?: string }) => {
    call++;
    if (options.failOn?.[call]) {
      throw options.failOn[call];
    }
    if (options.before) {
      await options.before(cursor, call);
    }
    const start = cursor ? Number(cursor) : 0;
    const page = records.slice(start, start + size);
    return {
      tips: page,
      nextCursor: page.length ? String(start + page.length) : undefined,
    };
  });
}

function horizonError(status: number): Error {
  return Object.assign(new Error(`Horizon ${status}`), {
    response: { status },
  });
}

describeWithDb("tip total reconciliation (PostgreSQL)", () => {
  let schema: TestSchema;

  beforeEach(async () => {
    schema = await createTestSchema("tips");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);
  });

  afterEach(async () => {
    await schema.drop();
  });

  const q = (text: string, params: unknown[] = []) =>
    schema.pool.query(text, params);
  const executor = () => poolExecutor(schema.pool);

  async function createUser(
    name: string,
    opts: {
      wallet?: string;
      reconciledAgo?: string | null;
      total?: string;
    } = {}
  ): Promise<string> {
    const { rows } = await q(
      `INSERT INTO users (username, wallet, total_tips_received, tips_reconciled_at)
       VALUES ($1, $2, $3, CASE WHEN $4::text IS NULL THEN NULL ELSE NOW() - $4::interval END)
       RETURNING id`,
      [
        name,
        opts.wallet ?? wallet(name),
        opts.total ?? "0",
        opts.reconciledAgo ?? null,
      ]
    );
    return rows[0].id;
  }

  async function user(id: string) {
    const { rows } = await q(
      `SELECT total_tips_received::text AS total, total_tips_count AS count,
              tip_totals_version::int AS version, tips_reconciled_at, last_tip_at
         FROM users WHERE id = $1`,
      [id]
    );
    return rows[0];
  }

  async function checkpoint(id: string) {
    const { rows } = await q(
      `SELECT cursor, total_stroops::text AS stroops, tip_count, pages, caught_up_at
         FROM tip_reconciliation_checkpoints WHERE user_id = $1`,
      [id]
    );
    return rows[0];
  }

  async function recordedTips(): Promise<string[]> {
    const { rows } = await q(
      "SELECT tx_hash FROM tip_transactions ORDER BY tx_hash"
    );
    return rows.map(r => r.tx_hash);
  }

  describe("reconcileUserTipTotals", () => {
    it("writes the ledger-derived totals and records the tips", async () => {
      const fan = await createUser("fan");
      const creator = await createUser("creator", { total: "999" });

      const result = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger([
          tip("10.5", "hash-a", wallet("fan")),
          tip("0.25", "hash-bb", wallet("stranger")),
        ]),
        getXlmUsdPrice: async () => 0.1,
      });

      expect(result.status).toBe("complete");
      expect(result.discrepancy).toBe("-988.2500000");
      const row = await user(creator);
      expect(row).toEqual(
        expect.objectContaining({ total: "10.7500000", count: 2, version: 1 })
      );
      expect(row.tips_reconciled_at).not.toBeNull();
      const { rows } = await q(
        "SELECT tx_hash, supporter_id FROM tip_transactions ORDER BY tx_hash"
      );
      expect(rows).toEqual([
        { tx_hash: "hash-a", supporter_id: fan },
        { tx_hash: "hash-bb", supporter_id: null },
      ]);
      expect((await checkpoint(creator)).caught_up_at).not.toBeNull();
    });

    it("an account Horizon does not know (never funded) has no tips", async () => {
      const creator = await createUser("unfunded", { total: "3" });
      const result = await reconcileUserTipTotals(creator, wallet("unfunded"), {
        executor: executor(),
        fetchPayments: ledger([], { failOn: { 1: horizonError(404) } }),
      });
      expect(result.status).toBe("complete");
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "0.0000000", count: 0 })
      );
    });

    it("once caught up, only reads payments after the checkpoint", async () => {
      const creator = await createUser("creator");
      const records = tips(3);
      await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger(records),
      });

      records.push(tip("10", "later"));
      const fetchPayments = ledger(records);
      const second = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments,
      });

      expect(fetchPayments.mock.calls[0][0]).toEqual(
        expect.objectContaining({ cursor: "3", order: "asc" })
      );
      expect(second.status).toBe("complete");
      expect(second.discrepancy).toBe("10.0000000");
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "16.0000000", count: 4 })
      );
      expect(await recordedTips()).toHaveLength(4);
    });

    describe("partial failure mid-walk", () => {
      it("keeps the processed pages, writes no partial total, and resumes at the checkpoint", async () => {
        const creator = await createUser("creator", { total: "7" });
        const records = tips(7); // pages: [1,2] [3,4] [5,6] [7] then end
        const timeout = new DownstreamTimeoutError("horizon", 8_000);

        const first = await reconcileUserTipTotals(creator, wallet("creator"), {
          executor: executor(),
          fetchPayments: ledger(records, { failOn: { 4: timeout } }),
        });

        // Pages 1-3 are recorded and checkpointed; the 4th call timed out.
        expect(first.status).toBe("interrupted");
        expect(first.error).toBe(timeout);
        expect(first.pages).toBe(3);
        expect(await checkpoint(creator)).toEqual(
          expect.objectContaining({
            cursor: "6",
            stroops: String(21 * 10_000_000),
            tip_count: 6,
            pages: 3,
            caught_up_at: null,
          })
        );
        expect(await recordedTips()).toHaveLength(6);
        // The visible total is untouched: never a partial sum.
        expect(await user(creator)).toEqual(
          expect.objectContaining({ total: "7.0000000", count: 0, version: 0 })
        );

        const fetchPayments = ledger(records);
        const resumed = await reconcileUserTipTotals(
          creator,
          wallet("creator"),
          { executor: executor(), fetchPayments }
        );

        expect(fetchPayments.mock.calls[0][0].cursor).toBe("6");
        expect(resumed.status).toBe("complete");
        expect(await user(creator)).toEqual(
          expect.objectContaining({ total: "28.0000000", count: 7, version: 1 })
        );
        expect(await recordedTips()).toHaveLength(7);
      });

      it("a crash between recording a page and checkpointing it neither loses nor double-counts it", async () => {
        const creator = await createUser("creator");
        const records = tips(4);
        // The crash window: the page's tips are already recorded, as if a
        // previous worker died right after the insert.
        await q(
          `INSERT INTO tip_transactions (creator_id, amount_xlm, tx_hash, memo, created_at)
           VALUES ($1, 1, 't0', 'StreamFi Tip', NOW()), ($1, 2, 't1', 'StreamFi Tip', NOW())`,
          [creator]
        );

        const result = await reconcileUserTipTotals(
          creator,
          wallet("creator"),
          {
            executor: executor(),
            fetchPayments: ledger(records),
          }
        );

        expect(result.status).toBe("complete");
        expect(await user(creator)).toEqual(
          expect.objectContaining({ total: "10.0000000", count: 4 })
        );
        expect(await recordedTips()).toEqual(["t0", "t1", "t2", "t3"]);
      });
    });

    it("stops at the page budget and continues where it stopped", async () => {
      const creator = await createUser("creator");
      const records = tips(9);

      const first = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger(records),
        maxPages: 2,
      });
      expect(first.status).toBe("in_progress");
      expect(first.cursor).toBe("4");
      expect((await user(creator)).version).toBe(0);

      const second = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger(records),
        maxPages: 10,
      });
      expect(second.status).toBe("complete");
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "45.0000000", count: 9 })
      );
    });

    it("stops at the time budget", async () => {
      const creator = await createUser("creator");
      let clock = 0;
      const result = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger(tips(9), {
          before: async () => {
            clock += 1_000;
          },
        }),
        timeBudgetMs: 2_500,
        now: () => clock,
      });
      expect(result.status).toBe("in_progress");
      expect(result.pages).toBe(3);
    });

    it("never loses a tip the webhook credited while the walk was finishing", async () => {
      const creator = await createUser("creator");
      const records = [tip("5", "old")];
      let credited = false;
      const fetchPayments = ledger(records, {
        // When the walk reads what it believes is the end, a new payment
        // lands and the webhook credits it (bumping the version).
        before: async cursor => {
          if (cursor === "1" && !credited) {
            credited = true;
            records.push(tip("1", "new"));
            await q(
              `UPDATE users SET total_tips_received = total_tips_received + 1,
                      total_tips_count = total_tips_count + 1,
                      tip_totals_version = tip_totals_version + 1
                WHERE id = $1`,
              [creator]
            );
          }
        },
      });

      const result = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments,
      });

      expect(result.status).toBe("complete");
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "6.0000000", count: 2, version: 2 })
      );
    });

    it("gives up (stale) instead of looping when other writers keep changing the totals", async () => {
      const creator = await createUser("creator", { total: "4" });
      const fetchPayments = ledger([], {
        before: async () => {
          await q(
            "UPDATE users SET tip_totals_version = tip_totals_version + 1 WHERE id = $1",
            [creator]
          );
        },
      });
      const result = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments,
        maxWriteAttempts: 3,
      });
      expect(result.status).toBe("stale");
      expect(fetchPayments).toHaveBeenCalledTimes(3);
      expect((await user(creator)).total).toBe("4.0000000");
    });

    it("two concurrent workers never add the same page twice", async () => {
      const creator = await createUser("creator");
      const records = tips(6);
      let release: () => void = () => undefined;
      const slowFirstPage = new Promise<void>(resolve => {
        release = resolve;
      });

      // Worker A reads page 1 and stalls before checkpointing it...
      const workerA = reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger(records, {
          before: async (_cursor, call) => {
            if (call === 1) {
              await slowFirstPage;
            }
          },
        }),
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      // ...while worker B walks the whole history.
      const workerB = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger(records),
      });
      release();

      expect(workerB.status).toBe("complete");
      expect((await workerA).status).toBe("superseded");
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "21.0000000", count: 6 })
      );
      expect(await checkpoint(creator)).toEqual(
        expect.objectContaining({ tip_count: 6, stroops: "210000000" })
      );
    });

    it("starts over when the creator's wallet changes", async () => {
      const creator = await createUser("creator");
      await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        fetchPayments: ledger(tips(3)),
      });
      await q("UPDATE users SET wallet = $2 WHERE id = $1", [
        creator,
        wallet("newwallet"),
      ]);

      const fetchPayments = ledger([tip("2", "n1")]);
      const result = await reconcileUserTipTotals(
        creator,
        wallet("newwallet"),
        { executor: executor(), fetchPayments }
      );

      expect(fetchPayments.mock.calls[0][0].cursor).toBeUndefined();
      expect(result.status).toBe("complete");
      expect((await user(creator)).total).toBe("2.0000000");
    });

    describe("degraded Horizon", () => {
      function breakerFetch(
        breaker: CircuitBreaker,
        downstream: jest.Mock
      ): FetchPayments {
        return params => breaker.execute(() => downstream(params));
      }

      it("does not hang on a Horizon that never answers, and then fails fast", async () => {
        const creator = await createUser("creator", { total: "1" });
        const breaker = new CircuitBreaker(
          {
            name: "horizon-test",
            failureThreshold: 2,
            failureRate: 0.5,
            windowMs: 60_000,
            cooldownMs: 60_000,
            timeoutMs: 100,
          },
          { store: createMemoryBreakerStore() }
        );
        const hung = jest.fn(() => new Promise(() => undefined));

        for (let i = 0; i < 2; i++) {
          const started = Date.now();
          const result = await reconcileUserTipTotals(
            creator,
            wallet("creator"),
            { executor: executor(), fetchPayments: breakerFetch(breaker, hung) }
          );
          expect(result.status).toBe("interrupted");
          expect(result.error).toBeInstanceOf(DownstreamTimeoutError);
          expect(Date.now() - started).toBeLessThan(2_000);
        }

        // The breaker is open now: the next attempt does not call Horizon.
        const fast = await reconcileUserTipTotals(creator, wallet("creator"), {
          executor: executor(),
          fetchPayments: breakerFetch(breaker, hung),
        });
        expect(fast.status).toBe("interrupted");
        expect(fast.error).toBeInstanceOf(CircuitOpenError);
        expect(hung).toHaveBeenCalledTimes(2);
        expect((await user(creator)).total).toBe("1.0000000");
      });
    });
  });

  describe("reconcileStaleTipTotals job", () => {
    it("reconciles never-reconciled users first, then the oldest, within the batch", async () => {
      const recent = await createUser("recent", { reconciledAgo: "1 hour" });
      const old = await createUser("old", { reconciledAgo: "3 days" });
      const older = await createUser("older", { reconciledAgo: "9 days" });
      const never = await createUser("never");
      await createUser("notstellar", { wallet: "0xabc" });

      const fetchPayments = ledger([]);
      const outcome = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments,
        batchSize: 2,
        concurrency: 1,
      });

      expect(outcome.metrics.selected).toBe(2);
      expect(outcome.detail!.map(d => d.userId)).toEqual([never, older]);
      expect((await user(old)).version).toBe(0);
      expect((await user(recent)).version).toBe(0);

      const next = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments,
        batchSize: 10,
      });
      expect(next.detail!.map(d => d.userId)).toEqual([old]);
    });

    it("a failing user does not stop the others and backs off before retrying", async () => {
      const bad = await createUser("bad");
      const good = await createUser("good");
      const fetchPayments = jest.fn(
        async ({
          publicKey,
          cursor,
        }: {
          publicKey: string;
          cursor?: string;
        }) => {
          if (publicKey === wallet("bad")) {
            throw horizonError(400);
          }
          return cursor
            ? { tips: [], nextCursor: undefined }
            : { tips: [tip("7", "g1")], nextCursor: "1" };
        }
      );

      const outcome = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments,
      });

      expect(outcome.status).toBe("partial");
      expect(outcome.metrics).toEqual(
        expect.objectContaining({
          selected: 2,
          reconciled: 1,
          failed: 1,
          corrected: 1,
        })
      );
      expect((await user(good)).total).toBe("7.0000000");
      expect((await user(bad)).tips_reconciled_at).toBeNull();

      const retry = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments,
      });
      expect(retry.metrics.selected).toBe(0);
    });

    it("overlapping runs never reconcile the same user twice", async () => {
      for (let i = 0; i < 6; i++) {
        await createUser(`user${i}`);
      }
      const fetchPayments = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return { tips: [], nextCursor: undefined };
      });
      const options = { executor: executor(), fetchPayments, batchSize: 4 };

      const [a, b] = await Promise.all([
        reconcileStaleTipTotals(options),
        reconcileStaleTipTotals(options),
      ]);

      const ids = [...a.detail!, ...b.detail!].map(d => d.userId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(6);
      expect(fetchPayments).toHaveBeenCalledTimes(6);
    });

    it("stops starting users once Horizon's circuit opens and gives them back their place", async () => {
      for (let i = 0; i < 4; i++) {
        await createUser(`co${i}`);
      }
      const fetchPayments = jest.fn(async () => {
        throw new CircuitOpenError("horizon", 30_000);
      });

      const outcome = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments,
        concurrency: 1,
      });

      expect(fetchPayments).toHaveBeenCalledTimes(1);
      expect(outcome.metrics).toEqual(
        expect.objectContaining({ failed: 0, deferred: 4 })
      );
      expect(outcome.alerts).toEqual([
        expect.stringMatching(
          /Horizon circuit open: .* 4 user\(s\) were deferred/
        ),
      ]);
      const { rows } = await q(
        "SELECT COUNT(*)::int AS n FROM users WHERE tips_reconcile_attempted_at IS NULL"
      );
      expect(rows[0].n).toBe(4);
    });

    it("a history longer than one run's budget continues on the next run", async () => {
      const creator = await createUser("long");
      const records = tips(10);

      const first = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments: ledger(records),
        maxPagesPerUser: 2,
      });
      expect(first.metrics).toEqual(
        expect.objectContaining({ in_progress: 1, reconciled: 0 })
      );
      // Requeued at once, not held back by the failure backoff.
      const { rows } = await q(
        "SELECT tips_reconcile_attempted_at FROM users WHERE id = $1",
        [creator]
      );
      expect(rows[0].tips_reconcile_attempted_at).toBeNull();

      const second = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments: ledger(records),
        maxPagesPerUser: 20,
      });
      expect(second.metrics.reconciled).toBe(1);
      expect((await user(creator)).total).toBe("55.0000000");
    });

    it("reports large discrepancies once per run", async () => {
      await createUser("drifted", { total: "1000" });
      await createUser("fine", { total: "2" });
      const fetchPayments = jest.fn(
        async ({
          publicKey,
          cursor,
        }: {
          publicKey: string;
          cursor?: string;
        }) =>
          cursor
            ? { tips: [], nextCursor: undefined }
            : {
                tips: [
                  tip(
                    publicKey === wallet("drifted") ? "10" : "2",
                    `x${publicKey.slice(0, 6)}`
                  ),
                ],
                nextCursor: "1",
              }
      );

      const outcome = await reconcileStaleTipTotals({
        executor: executor(),
        fetchPayments,
        discrepancyAlertXlm: 100,
      });

      expect(outcome.metrics).toEqual(
        expect.objectContaining({ corrected: 2, large_discrepancies: 1 })
      );
      expect(outcome.alerts).toHaveLength(1);
    });
  });

  describe("Stellar payment webhook", () => {
    const creatorWallet = wallet("creatorwh");
    const fanWallet = wallet("fanwh");

    beforeEach(() => {
      global.fetch = jest.fn(async (url: RequestInfo | URL) => {
        const href = String(url);
        if (href.includes("coingecko")) {
          return new Response(JSON.stringify({ stellar: { usd: 0.1 } }));
        }
        if (href.endsWith("/operations")) {
          return new Response(
            JSON.stringify({
              _embedded: {
                records: [
                  {
                    type: "payment",
                    asset_type: "native",
                    from: fanWallet,
                    to: creatorWallet,
                    amount: "2.5",
                  },
                ],
              },
            })
          );
        }
        return new Response(
          JSON.stringify({
            successful: true,
            _links: { operations: { href: `${href}/operations` } },
          })
        );
      }) as typeof fetch;
    });

    function delivery() {
      return new NextRequest(
        "http://localhost/api/routes-f/webhooks-stellar-payment",
        {
          method: "POST",
          body: JSON.stringify({
            tx_hash: "dup-tx",
            from: fanWallet,
            to: creatorWallet,
            amount: "2.5",
          }),
        }
      );
    }

    it("credits a transaction once even when it is delivered concurrently", async () => {
      const creator = await createUser("creatorwh", { wallet: creatorWallet });

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => paymentWebhook(delivery()))
      );

      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "2.5000000", count: 1, version: 1 })
      );
    });
  });
});
