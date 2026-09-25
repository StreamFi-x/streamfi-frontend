/**
 * @jest-environment node
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

const mockCall = jest.fn();
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  const builder = {
    forAccount: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    cursor: jest.fn(() => builder),
    order: jest.fn(() => builder),
    call: (...args: unknown[]) => mockCall(...args),
  };
  return {
    ...actual,
    Horizon: { Server: jest.fn(() => ({ payments: () => builder })) },
  };
});

import {
  fetchLedgerTipTotals,
  fromStroops,
  HorizonRateLimitedError,
  LedgerHistoryTooLargeError,
  LedgerTip,
  toStroops,
} from "@/lib/stellar/tip-reconciliation";

const ACCOUNT = "GCREATORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

function tip(amount: string, hash: string, timestamp: string): LedgerTip {
  return { sender: "GSENDER", amount, txHash: hash, timestamp };
}

function horizonError(status: number) {
  return Object.assign(new Error(`status ${status}`), {
    response: { status },
  });
}

describe("stroop arithmetic", () => {
  it("sums amounts exactly, unlike floating point", () => {
    const total = ["0.1", "0.2", "1234567.1234567"]
      .map(toStroops)
      .reduce((a, b) => a + b, BigInt(0));
    expect(fromStroops(total)).toBe("1234567.4234567");
  });

  it("handles integers, empty values and negatives", () => {
    expect(fromStroops(toStroops("5"))).toBe("5.0000000");
    expect(fromStroops(toStroops(null))).toBe("0.0000000");
    expect(fromStroops(toStroops("-1.5"))).toBe("-1.5000000");
    expect(toStroops(12.5)).toBe(BigInt(125_000_000));
  });

  it("rejects malformed amounts", () => {
    expect(() => toStroops("1.2.3")).toThrow(/Invalid XLM amount/);
  });
});

describe("fetchLedgerTipTotals", () => {
  const sleep = jest.fn(async () => undefined);

  beforeEach(() => {
    sleep.mockClear();
    mockCall.mockReset();
  });

  it("pages through the complete history and aggregates it", async () => {
    const fetchPayments = jest
      .fn()
      .mockResolvedValueOnce({
        tips: [
          tip("10", "h3", "2026-09-03T00:00:00Z"),
          tip("0.1", "h2", "2026-09-02T00:00:00Z"),
        ],
        nextCursor: "c1",
      })
      .mockResolvedValueOnce({
        tips: [tip("0.2", "h1", "2026-09-01T00:00:00Z")],
        nextCursor: "c2",
      })
      .mockResolvedValueOnce({ tips: [], nextCursor: undefined });

    const totals = await fetchLedgerTipTotals(ACCOUNT, {
      fetchPayments,
      sleep,
    });

    expect(fetchPayments.mock.calls.map(c => c[0].cursor)).toEqual([
      undefined,
      "c1",
      "c2",
    ]);
    expect(totals).toEqual(
      expect.objectContaining({
        totalReceived: "10.3000000",
        totalCount: 3,
        lastTipAt: "2026-09-03T00:00:00Z",
        requests: 3,
        retries: 0,
      })
    );
  });

  it("keeps paging past pages that contain no tips", async () => {
    const fetchPayments = jest
      .fn()
      .mockResolvedValueOnce({ tips: [], nextCursor: "outgoing-only" })
      .mockResolvedValueOnce({
        tips: [tip("1", "h", "2026-01-01T00:00:00Z")],
        nextCursor: "x",
      })
      .mockResolvedValueOnce({ tips: [], nextCursor: undefined });

    const totals = await fetchLedgerTipTotals(ACCOUNT, {
      fetchPayments,
      sleep,
    });

    expect(totals.totalCount).toBe(1);
  });

  it("treats an account Horizon does not know as having no tips", async () => {
    const fetchPayments = jest.fn().mockRejectedValue(horizonError(404));

    const totals = await fetchLedgerTipTotals(ACCOUNT, {
      fetchPayments,
      sleep,
    });

    expect(totals).toEqual(
      expect.objectContaining({
        totalReceived: "0.0000000",
        totalCount: 0,
        lastTipAt: null,
      })
    );
  });

  it("retries rate limits and server errors with exponential backoff", async () => {
    const fetchPayments = jest
      .fn()
      .mockRejectedValueOnce(horizonError(429))
      .mockRejectedValueOnce(horizonError(503))
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce({
        tips: [tip("2", "h", "2026-01-01T00:00:00Z")],
        nextCursor: undefined,
      });

    const totals = await fetchLedgerTipTotals(ACCOUNT, {
      fetchPayments,
      sleep,
      policy: { baseDelayMs: 100, maxDelayMs: 1000 },
    });

    expect(totals.totalReceived).toBe("2.0000000");
    expect(totals).toEqual(
      expect.objectContaining({ requests: 4, retries: 3, rateLimited: 1 })
    );
    const delays = (sleep.mock.calls as unknown as number[][]).map(c => c[0]);
    expect(delays[0]).toBeGreaterThanOrEqual(50);
    expect(delays[0]).toBeLessThanOrEqual(100);
    expect(delays[2]).toBeGreaterThanOrEqual(200);
    expect(delays[2]).toBeLessThanOrEqual(400);
  });

  it("gives up with a rate-limit error after the retry budget", async () => {
    const fetchPayments = jest.fn().mockRejectedValue(horizonError(429));

    await expect(
      fetchLedgerTipTotals(ACCOUNT, {
        fetchPayments,
        sleep,
        policy: { maxRetries: 2 },
      })
    ).rejects.toBeInstanceOf(HorizonRateLimitedError);
    expect(fetchPayments).toHaveBeenCalledTimes(3);
  });

  it("does not retry client errors", async () => {
    const fetchPayments = jest.fn().mockRejectedValue(horizonError(400));

    await expect(
      fetchLedgerTipTotals(ACCOUNT, { fetchPayments, sleep })
    ).rejects.toThrow("status 400");
    expect(fetchPayments).toHaveBeenCalledTimes(1);
  });

  it("does not treat a 404 after the first page as an empty account", async () => {
    const fetchPayments = jest
      .fn()
      .mockResolvedValueOnce({
        tips: [tip("1", "h", "2026-01-01T00:00:00Z")],
        nextCursor: "c",
      })
      .mockRejectedValue(horizonError(404));

    await expect(
      fetchLedgerTipTotals(ACCOUNT, { fetchPayments, sleep })
    ).rejects.toThrow("status 404");
  });

  it("refuses to produce a partial total for an oversized history", async () => {
    const fetchPayments = jest
      .fn()
      .mockResolvedValue({
        tips: [tip("1", "h", "2026-01-01T00:00:00Z")],
        nextCursor: "more",
      });

    await expect(
      fetchLedgerTipTotals(ACCOUNT, {
        fetchPayments,
        sleep,
        policy: { maxPages: 3 },
      })
    ).rejects.toBeInstanceOf(LedgerHistoryTooLargeError);
    expect(fetchPayments).toHaveBeenCalledTimes(3);
  });

  it("uses the existing Horizon tip definition by default (native incoming payments only)", async () => {
    mockCall
      .mockResolvedValueOnce({
        records: [
          {
            type: "payment",
            to: ACCOUNT,
            from: "GA",
            asset_type: "native",
            amount: "5",
            transaction_hash: "t1",
            created_at: "2026-02-01T00:00:00Z",
            paging_token: "p1",
          },
          {
            type: "payment",
            to: ACCOUNT,
            from: "GB",
            asset_type: "credit_alphanum4",
            amount: "7",
            transaction_hash: "t2",
            created_at: "2026-02-01T00:00:00Z",
            paging_token: "p2",
          },
          {
            type: "payment",
            to: "GOTHER",
            from: ACCOUNT,
            asset_type: "native",
            amount: "9",
            transaction_hash: "t3",
            created_at: "2026-02-01T00:00:00Z",
            paging_token: "p3",
          },
          {
            type: "path_payment_strict_receive",
            to: ACCOUNT,
            from: "GC",
            asset_type: "native",
            amount: "1.5",
            transaction_hash: "t4",
            created_at: "2026-03-01T00:00:00Z",
            paging_token: "p4",
          },
        ],
      })
      .mockResolvedValueOnce({ records: [] });

    const totals = await fetchLedgerTipTotals(ACCOUNT, { sleep });

    expect(totals.totalReceived).toBe("6.5000000");
    expect(totals.tips.map(t => t.txHash)).toEqual(["t1", "t4"]);
  });
});
