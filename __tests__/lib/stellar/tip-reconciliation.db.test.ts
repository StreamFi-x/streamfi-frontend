/**
 * @jest-environment node
 *
 * #1400 tip total reconciliation against real PostgreSQL.
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

/** Horizon stand-in: one page with the given tips, then the end marker. */
function ledger(tips: LedgerTip[], beforeReturn?: () => Promise<void>) {
  return jest.fn(async ({ cursor }: { cursor?: string }) => {
    if (cursor) {
      return { tips: [], nextCursor: undefined };
    }
    if (beforeReturn) {
      await beforeReturn();
    }
    return { tips, nextCursor: tips.length ? "end" : undefined };
  });
}

const noSleep = { sleep: async () => undefined };

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

  describe("reconcileUserTipTotals", () => {
    it("writes the ledger-derived totals and records the tips", async () => {
      const fan = await createUser("fan");
      const creator = await createUser("creator", { total: "999" });
      const tips = [
        tip("10.5", "hash-a", wallet("fan")),
        tip("0.25", "hash-bb", wallet("stranger")),
      ];

      const result = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        ledger: { fetchPayments: ledger(tips), ...noSleep },
        getXlmUsdPrice: async () => 0.1,
      });

      expect(result.status).toBe("updated");
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
    });

    it("is idempotent: repeating it changes nothing but the bookkeeping", async () => {
      const creator = await createUser("creator");
      const tips = [tip("1", "h1"), tip("2", "h22")];
      const options = {
        executor: executor(),
        ledger: { fetchPayments: ledger(tips), ...noSleep },
      };

      await reconcileUserTipTotals(creator, wallet("creator"), options);
      const second = await reconcileUserTipTotals(
        creator,
        wallet("creator"),
        options
      );

      expect(second.discrepancy).toBe("0.0000000");
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "3.0000000", count: 2 })
      );
      const { rows } = await q(
        "SELECT COUNT(*)::int AS n FROM tip_transactions"
      );
      expect(rows[0].n).toBe(2);
    });

    it("never overwrites a tip the webhook credited while the ledger was being read", async () => {
      const creator = await createUser("creator", { total: "5" });
      const fetchPayments = ledger([tip("5", "old")], async () => {
        await q(
          `UPDATE users SET total_tips_received = total_tips_received + 1,
                  total_tips_count = total_tips_count + 1,
                  tip_totals_version = tip_totals_version + 1
            WHERE id = $1`,
          [creator]
        );
      });

      const result = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        ledger: { fetchPayments, ...noSleep },
      });

      expect(result.status).toBe("stale");
      expect((await user(creator)).total).toBe("6.0000000");
    });

    it("a slow scheduled run cannot overwrite a newer manual refresh", async () => {
      const creator = await createUser("creator");
      let releaseScheduled: () => void = () => undefined;
      const scheduledMayFinish = new Promise<void>(resolve => {
        releaseScheduled = resolve;
      });

      // Scheduled run reads the old ledger (1 tip) and stalls...
      const scheduled = reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        ledger: {
          fetchPayments: ledger([tip("1", "t1")], () => scheduledMayFinish),
          ...noSleep,
        },
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      // ...while a manual refresh sees the newer ledger (2 tips) and commits.
      const manual = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        ledger: {
          fetchPayments: ledger([tip("1", "t1"), tip("4", "t22")]),
          ...noSleep,
        },
      });
      releaseScheduled();

      expect(manual.status).toBe("updated");
      expect((await scheduled).status).toBe("stale");
      expect(await user(creator)).toEqual(
        expect.objectContaining({ total: "5.0000000", count: 2 })
      );
    });

    it("manual refresh retries against the newer state after a concurrent write", async () => {
      const creator = await createUser("creator");
      let first = true;
      const fetchPayments = ledger([tip("3", "t1")], async () => {
        if (first) {
          first = false;
          await q(
            "UPDATE users SET tip_totals_version = tip_totals_version + 1 WHERE id = $1",
            [creator]
          );
        }
      });

      const result = await reconcileUserTipTotals(creator, wallet("creator"), {
        executor: executor(),
        ledger: { fetchPayments, ...noSleep },
        maxAttempts: 3,
      });

      expect(result.status).toBe("updated");
      expect((await user(creator)).total).toBe("3.0000000");
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
        ledger: { fetchPayments, ...noSleep },
        batchSize: 2,
        concurrency: 1,
      });

      expect(outcome.metrics.selected).toBe(2);
      expect(outcome.detail!.map(d => d.userId)).toEqual([never, older]);
      expect((await user(old)).version).toBe(0);
      expect((await user(recent)).version).toBe(0);

      const next = await reconcileStaleTipTotals({
        executor: executor(),
        ledger: { fetchPayments, ...noSleep },
        batchSize: 10,
      });
      expect(next.detail!.map(d => d.userId)).toEqual([old]);
    });

    it("a failing user does not stop the others and backs off before retrying", async () => {
      const bad = await createUser("bad");
      const good = await createUser("good");
      const fetchPayments = jest.fn(
        async ({ publicKey }: { publicKey: string }) => {
          if (publicKey === wallet("bad")) {
            throw Object.assign(new Error("bad request"), {
              response: { status: 400 },
            });
          }
          return { tips: [tip("7", "g1")], nextCursor: undefined };
        }
      );

      const outcome = await reconcileStaleTipTotals({
        executor: executor(),
        ledger: { fetchPayments, ...noSleep },
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
        ledger: { fetchPayments, ...noSleep },
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
      const options = {
        executor: executor(),
        ledger: { fetchPayments, ...noSleep },
        batchSize: 4,
      };

      const [a, b] = await Promise.all([
        reconcileStaleTipTotals(options),
        reconcileStaleTipTotals(options),
      ]);

      const ids = [...a.detail!, ...b.detail!].map(d => d.userId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(6);
      expect(fetchPayments).toHaveBeenCalledTimes(6);
    });

    it("stops early on Horizon rate limiting and returns deferred users to the queue", async () => {
      for (let i = 0; i < 4; i++) {
        await createUser(`rl${i}`);
      }
      const fetchPayments = jest.fn(async () => {
        throw Object.assign(new Error("rate limited"), {
          response: { status: 429 },
        });
      });

      const outcome = await reconcileStaleTipTotals({
        executor: executor(),
        ledger: { fetchPayments, policy: { maxRetries: 1 }, ...noSleep },
        concurrency: 1,
      });

      expect(outcome.metrics).toEqual(
        expect.objectContaining({ failed: 1, deferred: 3 })
      );
      expect(outcome.alerts).toEqual([
        expect.stringMatching(
          /Horizon rate limiting stopped the run early; 3 user\(s\) deferred/
        ),
      ]);
      const { rows } = await q(
        "SELECT COUNT(*)::int AS n FROM users WHERE tips_reconcile_attempted_at IS NULL"
      );
      expect(rows[0].n).toBe(3);
    });

    it("reports large discrepancies once per run", async () => {
      await createUser("drifted", { total: "1000" });
      await createUser("fine", { total: "2" });
      const fetchPayments = jest.fn(
        async ({ publicKey }: { publicKey: string }) => ({
          tips: [
            tip(
              publicKey === wallet("drifted") ? "10" : "2",
              `x${publicKey.slice(0, 6)}`
            ),
          ],
          nextCursor: undefined,
        })
      );

      const outcome = await reconcileStaleTipTotals({
        executor: executor(),
        ledger: { fetchPayments, ...noSleep },
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
