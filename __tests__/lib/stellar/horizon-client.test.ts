/**
 * @jest-environment node
 */
jest.mock("@/lib/tracing/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { CircuitOpenError } from "@/lib/resilience/circuit-breaker";
import { resetBreakerStoreForTests } from "@/lib/resilience/circuit-breaker";
import { resetBreakersForTests } from "@/lib/resilience/breakers";
import { fetchHorizonJson } from "@/lib/stellar/horizon-client";

const fetchMock = jest.fn();

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
  resetBreakerStoreForTests();
  resetBreakersForTests();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("fetchHorizonJson", () => {
  it("resolves paths against the network's Horizon and strips HAL templates", async () => {
    fetchMock.mockImplementation(async () => json({ ok: true }));
    await fetchHorizonJson("/transactions/abc");
    await fetchHorizonJson(
      "https://horizon-testnet.stellar.org/transactions/abc/operations{?cursor,limit,order}"
    );
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
      "https://horizon-testnet.stellar.org/transactions/abc",
      "https://horizon-testnet.stellar.org/transactions/abc/operations",
    ]);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("throws a 404 with its status without counting it against Horizon", async () => {
    fetchMock.mockImplementation(async () => json({}, 404));
    for (let i = 0; i < 8; i++) {
      await expect(fetchHorizonJson("/transactions/x")).rejects.toMatchObject({
        response: { status: 404 },
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it("counts 5xx responses, so a failing Horizon trips the breaker", async () => {
    fetchMock.mockImplementation(async () => json({}, 503));
    for (let i = 0; i < 5; i++) {
      await expect(fetchHorizonJson("/transactions/x")).rejects.toMatchObject({
        response: { status: 503 },
      });
    }
    await expect(fetchHorizonJson("/transactions/x")).rejects.toBeInstanceOf(
      CircuitOpenError
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
