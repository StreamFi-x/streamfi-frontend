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
const mockBuilder = {
  forAccount: jest.fn(() => mockBuilder),
  limit: jest.fn(() => mockBuilder),
  cursor: jest.fn(() => mockBuilder),
  order: jest.fn(() => mockBuilder),
  call: (...args: unknown[]) => mockCall(...args),
};
const mockServers: { httpClient: { defaults: { timeout?: number } } }[] = [];
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn(() => {
        const server = {
          httpClient: { defaults: {} },
          payments: () => mockBuilder,
        };
        mockServers.push(server);
        return server;
      }),
    },
  };
});

import {
  CircuitOpenError,
  resetBreakerStoreForTests,
} from "@/lib/resilience/circuit-breaker";
import { resetBreakersForTests } from "@/lib/resilience/breakers";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import { resetHorizonServersForTests } from "@/lib/stellar/horizon-client";
import { fromStroops, toStroops } from "@/lib/stellar/tip-reconciliation";

const ACCOUNT = "GCREATORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

function horizonError(status: number) {
  return Object.assign(new Error(`status ${status}`), {
    response: { status },
  });
}

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetBreakerStoreForTests();
  resetBreakersForTests();
  resetHorizonServersForTests();
  mockServers.length = 0;
  mockCall.mockReset();
  jest.clearAllMocks();
});

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

describe("fetchPaymentsReceived", () => {
  it("keeps the Horizon tip definition (native incoming payments only)", async () => {
    mockCall.mockResolvedValueOnce({
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
    });

    const page = await fetchPaymentsReceived({ publicKey: ACCOUNT });

    expect(page.tips.map(t => t.txHash)).toEqual(["t1", "t4"]);
    // The cursor follows every record, not just the tips.
    expect(page.nextCursor).toBe("p4");
  });

  it("marks the end of the history with an empty page", async () => {
    mockCall.mockResolvedValueOnce({ records: [] });
    const page = await fetchPaymentsReceived({ publicKey: ACCOUNT });
    expect(page).toEqual({ tips: [], nextCursor: undefined });
  });

  it("walks oldest first from the start, or from a cursor, in asc order", async () => {
    mockCall.mockResolvedValue({ records: [] });

    await fetchPaymentsReceived({ publicKey: ACCOUNT, order: "asc" });
    expect(mockBuilder.order).toHaveBeenLastCalledWith("asc");
    expect(mockBuilder.cursor).not.toHaveBeenCalled();

    await fetchPaymentsReceived({
      publicKey: ACCOUNT,
      order: "asc",
      cursor: "p9",
    });
    expect(mockBuilder.cursor).toHaveBeenLastCalledWith("p9");
  });

  it("starts from the newest payment by default", async () => {
    mockCall.mockResolvedValue({ records: [] });
    await fetchPaymentsReceived({ publicKey: ACCOUNT });
    expect(mockBuilder.order).toHaveBeenLastCalledWith("desc");
    expect(mockBuilder.cursor).toHaveBeenLastCalledWith("now");
  });

  it("gives the Horizon HTTP client the breaker's timeout and reuses it", async () => {
    mockCall.mockResolvedValue({ records: [] });
    await fetchPaymentsReceived({ publicKey: ACCOUNT });
    await fetchPaymentsReceived({ publicKey: ACCOUNT });
    expect(mockServers).toHaveLength(1);
    expect(mockServers[0].httpClient.defaults.timeout).toBe(8_000);
  });

  it("fails fast once Horizon keeps failing, without calling it again", async () => {
    mockCall.mockRejectedValue(horizonError(503));
    for (let i = 0; i < 5; i++) {
      await expect(
        fetchPaymentsReceived({ publicKey: ACCOUNT })
      ).rejects.toMatchObject({ response: { status: 503 } });
    }
    mockCall.mockClear();

    await expect(
      fetchPaymentsReceived({ publicKey: ACCOUNT })
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it("does not count an unknown account (404) against Horizon's health", async () => {
    mockCall.mockRejectedValue(horizonError(404));
    for (let i = 0; i < 10; i++) {
      await expect(
        fetchPaymentsReceived({ publicKey: ACCOUNT })
      ).rejects.toMatchObject({ response: { status: 404 } });
    }
    expect(mockCall).toHaveBeenCalledTimes(10);
  });
});
