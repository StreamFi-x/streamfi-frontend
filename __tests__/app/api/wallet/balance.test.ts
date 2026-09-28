/**
 * @jest-environment node
 */
const mockAccountCall = jest.fn();
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn(() => ({
        httpClient: { defaults: {} },
        accounts: () => ({
          accountId: () => ({ call: () => mockAccountCall() }),
        }),
      })),
    },
  };
});
jest.mock("@/lib/tracing/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from "@/app/api/wallet/balance/route";
import { resetBreakerStoreForTests } from "@/lib/resilience/circuit-breaker";
import { resetBreakersForTests } from "@/lib/resilience/breakers";
import { resetHorizonServersForTests } from "@/lib/stellar/horizon-client";

const ADDRESS = `G${"WALLET".padEnd(55, "A")}`;
const get = (address = ADDRESS) =>
  GET(new Request(`http://localhost/api/wallet/balance?address=${address}`));

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  resetBreakerStoreForTests();
  resetBreakersForTests();
  resetHorizonServersForTests();
  mockAccountCall.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/wallet/balance", () => {
  it("rejects an invalid address", async () => {
    expect((await get("not-an-address")).status).toBe(400);
  });

  it("returns the native balance", async () => {
    mockAccountCall.mockResolvedValue({
      balances: [
        { asset_type: "credit_alphanum4", balance: "3" },
        { asset_type: "native", balance: "12.5000000" },
      ],
    });
    const res = await get();
    expect(await res.json()).toEqual({ balance: "12.5000000" });
  });

  it("reports an account that was never funded", async () => {
    mockAccountCall.mockRejectedValue(
      Object.assign(new Error("not found"), { response: { status: 404 } })
    );
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ balance: "0", unfunded: true });
  });

  it("answers 503 at once while Horizon's circuit is open", async () => {
    mockAccountCall.mockRejectedValue(
      Object.assign(new Error("bad gateway"), { response: { status: 502 } })
    );
    for (let i = 0; i < 5; i++) {
      expect((await get()).status).toBe(500);
    }
    mockAccountCall.mockClear();
    const res = await get();
    expect(res.status).toBe(503);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mockAccountCall).not.toHaveBeenCalled();
  });
});
