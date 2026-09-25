/**
 * @jest-environment node
 */
import { createSqlMock, type SqlCall } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/lib/stellar/horizon", () => ({
  fetchPaymentsReceived: jest.fn(),
  isHorizonNotFound: (err: { response?: { status?: number } }) =>
    err?.response?.status === 404,
}));
jest.mock("@/lib/jobs/retry", () => {
  const actual = jest.requireActual("@/lib/jobs/retry");
  return {
    ...actual,
    withRetry: (fn: () => Promise<unknown>, opts: object) =>
      actual.withRetry(fn, { ...opts, sleep: async () => {} }),
  };
});

import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import { runTipReconciliation } from "@/lib/stellar/tip-reconciliation";

const fetchPayments = fetchPaymentsReceived as jest.Mock;
const NOW = new Date("2026-09-25T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const RECENT = new Date(NOW.getTime() - 5 * HOUR).toISOString();
const CREATOR = "c1111111-1111-1111-1111-111111111111";
const OTHER_CREATOR = "c2222222-2222-2222-2222-222222222222";
const WALLET = "GCREATORWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const ctx = (deadlineExpired: () => boolean = () => false) => ({
  runId: "run-1",
  deadlineExpired,
  renewLease: jest.fn(async () => true),
});

function tip(txHash: string, amount: string, timestamp = RECENT) {
  return {
    id: `${txHash}-op`,
    sender: "GSENDER",
    amount,
    asset: "XLM",
    txHash,
    timestamp,
    ledger: 1,
  };
}

function page(
  tips: ReturnType<typeof tip>[],
  { next, oldest }: { next?: string; oldest?: string } = {}
) {
  return {
    tips,
    nextCursor: next,
    oldestRecordAt: oldest ?? tips[tips.length - 1]?.timestamp,
  };
}

function stored(
  txHash: string,
  amount: string,
  { creator = CREATOR, createdAt = RECENT } = {}
) {
  return {
    id: `row-${txHash}`,
    tx_hash: txHash,
    creator_id: creator,
    amount,
    created_at: createdAt,
  };
}

function stubDb(
  creators: Array<{ id: string; wallet: string }>,
  rowsByCreator: Record<string, ReturnType<typeof stored>[]>
) {
  mockDb.on(/SELECT now\(\) AS now/, { rows: [{ now: NOW.toISOString() }] });
  mockDb.once(/FROM users u WHERE u.id > /, { rows: creators });
  mockDb.on(/FROM users u WHERE u.id > /, { rows: [] });
  mockDb.on(
    /amount_xlm::text AS amount, created_at FROM tip_transactions/,
    (call: SqlCall) => ({
      rows: rowsByCreator[String(call.values[1])] ?? [],
    })
  );
  mockDb.on(/WITH supporter AS/, { rows: [{ id: "corr" }] });
  mockDb.on(/WITH upd AS/, { rowCount: 1 });
  mockDb.on(/INSERT INTO tip_reconciliation_corrections/, { rowCount: 1 });
}

const corrections = (pattern: RegExp) => mockDb.callsMatching(pattern);

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("runTipReconciliation", () => {
  it("applies and records every drift type for a creator", async () => {
    fetchPayments.mockResolvedValueOnce(
      page(
        [
          tip("tx-missing", "10.0000000"),
          tip("tx-amount", "5.0000000"),
          tip("tx-multi", "1.0000000"),
          tip("tx-multi", "2.0000000"),
          tip("tx-foreign", "7.0000000"),
        ],
        { oldest: new Date(NOW.getTime() - 100 * HOUR).toISOString() }
      )
    );
    stubDb([{ id: CREATOR, wallet: WALLET }], {
      [CREATOR]: [
        stored("tx-amount", "4.5000000"),
        stored("tx-multi", "3.0000000"),
        stored("tx-phantom", "99.0000000"),
        stored("tx-foreign", "7.0000000", { creator: OTHER_CREATOR }),
      ],
    });

    const { status, metrics } = await runTipReconciliation(ctx());

    expect(status).toBe("completed");
    expect(metrics).toMatchObject({ creators_scanned: 1, payments_scanned: 4 });

    const [insert] = corrections(/WITH supporter AS/);
    expect(insert.values).toEqual(
      expect.arrayContaining(["tx-missing", "10.0000000", CREATOR, "run-1"])
    );
    expect(insert.text).toMatch(
      /ON CONFLICT \(tx_hash\) WHERE tx_hash IS NOT NULL DO NOTHING/
    );

    const [update] = corrections(/WITH upd AS/);
    expect(update.values).toEqual(
      expect.arrayContaining([
        "5.0000000",
        "row-tx-amount",
        "4.5000000",
        "0.5000000",
      ])
    );
    // Conditional on the amount that was read: a concurrent writer wins.
    expect(update.text).toMatch(/AND amount_xlm = \$\?::numeric/);

    const flags = corrections(/^INSERT INTO tip_reconciliation_corrections/);
    const kinds = flags.map(f => f.values[1]);
    expect(kinds.sort()).toEqual(["CREATOR_MISMATCH", "NOT_ON_LEDGER"]);
    // Aggregated multi-op tx (1 + 2 = 3) matches the stored row: no correction.
    expect(
      JSON.stringify(
        corrections(/tip_reconciliation_corrections/).map(c => c.values)
      )
    ).not.toMatch(/tx-multi/);
    // Financial rows are never deleted.
    expect(corrections(/DELETE FROM tip_transactions/)).toHaveLength(0);
  });

  it("paginates Horizon until the lookback window is covered", async () => {
    fetchPayments
      .mockResolvedValueOnce(
        page([tip("tx-a", "1")], { next: "c1", oldest: RECENT })
      )
      .mockResolvedValueOnce(
        page(
          [
            tip(
              "tx-old",
              "1",
              new Date(NOW.getTime() - 200 * HOUR).toISOString()
            ),
          ],
          {
            next: "c2",
          }
        )
      );
    stubDb([{ id: CREATOR, wallet: WALLET }], {
      [CREATOR]: [stored("tx-a", "1.0000000")],
    });

    const { metrics } = await runTipReconciliation(ctx());

    expect(fetchPayments).toHaveBeenCalledTimes(2);
    expect(fetchPayments.mock.calls[1][0]).toMatchObject({ cursor: "c1" });
    // tx-old is outside the window: not inserted.
    expect(corrections(/WITH supporter AS/)).toHaveLength(0);
    expect(metrics.payments_scanned).toBe(1);
  });

  it("never flags NOT_ON_LEDGER when the window could not be read completely", async () => {
    fetchPayments.mockImplementation(async () =>
      page([tip(`tx-${Math.random()}`, "1")], { next: "more", oldest: RECENT })
    );
    stubDb([{ id: CREATOR, wallet: WALLET }], {
      [CREATOR]: [stored("tx-unseen", "1.0000000")],
    });

    const { status, metrics } = await runTipReconciliation(ctx());

    expect(status).toBe("partial");
    expect(metrics.creators_incomplete).toBe(1);
    expect(fetchPayments).toHaveBeenCalledTimes(10);
    expect(
      corrections(/^INSERT INTO tip_reconciliation_corrections/).map(
        c => c.values[1]
      )
    ).not.toContain("NOT_ON_LEDGER");
  });

  it("does not flag rows at the edge of the window", async () => {
    fetchPayments.mockResolvedValueOnce(page([], { oldest: undefined }));
    const edge = new Date(NOW.getTime() - 71.5 * HOUR).toISOString();
    stubDb([{ id: CREATOR, wallet: WALLET }], {
      [CREATOR]: [stored("tx-edge", "1.0000000", { createdAt: edge })],
    });

    await runTipReconciliation(ctx());

    expect(
      corrections(/^INSERT INTO tip_reconciliation_corrections/)
    ).toHaveLength(0);
  });

  it("retries transient Horizon errors", async () => {
    fetchPayments
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce(page([], {}));
    stubDb([{ id: CREATOR, wallet: WALLET }], {});

    const { status } = await runTipReconciliation(ctx());

    expect(status).toBe("completed");
    expect(fetchPayments).toHaveBeenCalledTimes(3);
  });

  it("treats a Horizon outage as a failed check, not as an empty ledger", async () => {
    fetchPayments
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(page([tip("tx-b", "2.0000000")], {}));
    stubDb(
      [
        { id: CREATOR, wallet: WALLET },
        { id: OTHER_CREATOR, wallet: WALLET },
      ],
      {
        [CREATOR]: [stored("tx-would-be-flagged", "5.0000000")],
        [OTHER_CREATOR]: [],
      }
    );

    const { status, metrics } = await runTipReconciliation(ctx());

    expect(status).toBe("partial");
    expect(metrics).toMatchObject({
      creators_scanned: 2,
      creators_failed: 1,
      failed_creator_ids: [CREATOR],
    });
    expect(
      corrections(/^INSERT INTO tip_reconciliation_corrections/).map(
        c => c.values[1]
      )
    ).not.toContain("NOT_ON_LEDGER");
    // The second creator was still reconciled.
    expect(corrections(/WITH supporter AS/)).toHaveLength(1);
  });

  it("does not retry a permanent Horizon error", async () => {
    fetchPayments.mockRejectedValueOnce({ response: { status: 400 } });
    stubDb([{ id: CREATOR, wallet: WALLET }], {});
    const { metrics } = await runTipReconciliation(ctx());
    expect(fetchPayments).toHaveBeenCalledTimes(1);
    expect(metrics.creators_failed).toBe(1);
  });

  it("treats a non-existent account as having no payments", async () => {
    fetchPayments.mockRejectedValueOnce({ response: { status: 404 } });
    stubDb([{ id: CREATOR, wallet: WALLET }], {
      [CREATOR]: [stored("tx-stored", "1.0000000")],
    });
    const { metrics } = await runTipReconciliation(ctx());
    expect(metrics.creators_failed).toBe(0);
    expect(
      corrections(/^INSERT INTO tip_reconciliation_corrections/).map(
        c => c.values[1]
      )
    ).toEqual(["NOT_ON_LEDGER"]);
  });

  it("stops at the deadline and reports a partial run", async () => {
    stubDb(
      [
        { id: CREATOR, wallet: WALLET },
        { id: OTHER_CREATOR, wallet: WALLET },
      ],
      {}
    );
    fetchPayments.mockResolvedValue(page([], {}));
    let checks = 0;
    const { status, metrics } = await runTipReconciliation(
      ctx(() => ++checks > 1)
    );
    expect(status).toBe("partial");
    expect(metrics.creators_scanned).toBe(1);
  });
});
