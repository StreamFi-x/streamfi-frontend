/**
 * @jest-environment node
 *
 * #1418: Mux calls go through their own circuit breaker with a bounded,
 * cancellable timeout, independently of Horizon's.
 */
const mockRetrieve = jest.fn();
const mockCreate = jest.fn();

jest.mock("@mux/mux-node", () => {
  class NotFoundError extends Error {
    status = 404;
  }
  function Mux() {
    return {
      video: {
        liveStreams: {
          retrieve: (...args: unknown[]) => mockRetrieve(...args),
          create: (...args: unknown[]) => mockCreate(...args),
        },
      },
    };
  }
  Mux.NotFoundError = NotFoundError;
  return { __esModule: true, default: Mux };
});
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  getHorizonBreaker,
  getMuxBreaker,
  resetBreakersForTests,
} from "@/lib/resilience/breakers";
import { resetBreakerStoreForTests } from "@/lib/resilience/circuit-breaker";
import { createMuxStream, getMuxLiveStreamState } from "@/lib/mux/server";

function muxError(status: number): Error {
  return Object.assign(new Error(`Mux ${status}`), { status });
}

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.CB_MUX_TIMEOUT_MS;
  resetBreakerStoreForTests();
  resetBreakersForTests();
  mockRetrieve.mockReset();
  mockCreate.mockReset();
});

it("passes the breaker's timeout and abort signal to the SDK, with SDK retries off", async () => {
  mockRetrieve.mockResolvedValue({ status: "active" });
  await getMuxLiveStreamState("s1");
  const [, options] = mockRetrieve.mock.calls[0];
  expect(options).toEqual({
    signal: expect.any(AbortSignal),
    timeout: 10_000,
    maxRetries: 0,
  });
});

it("opens after repeated Mux failures and then reports 'unknown' without calling Mux", async () => {
  mockRetrieve.mockRejectedValue(muxError(503));
  for (let i = 0; i < 5; i++) {
    expect(await getMuxLiveStreamState("s1")).toMatchObject({
      state: "unknown",
      httpStatus: 503,
    });
  }
  expect(await getMuxBreaker().state()).toBe("open");
  mockRetrieve.mockClear();

  const state = await getMuxLiveStreamState("s1");
  expect(state).toMatchObject({
    state: "unknown",
    error: expect.stringMatching(/circuit open/),
  });
  expect(mockRetrieve).not.toHaveBeenCalled();
});

it("does not trip on 404s: a deleted stream is a healthy answer", async () => {
  mockRetrieve.mockRejectedValue(muxError(404));
  for (let i = 0; i < 10; i++) {
    expect(await getMuxLiveStreamState("gone")).toEqual({ state: "not_found" });
  }
  expect(await getMuxBreaker().state()).toBe("closed");
});

it("bounds a slow Mux response by the configured timeout and aborts it", async () => {
  process.env.CB_MUX_TIMEOUT_MS = "50";
  resetBreakersForTests();
  let signal: AbortSignal | undefined;
  mockCreate.mockImplementation(
    (_body: unknown, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise(() => undefined);
    }
  );

  const started = Date.now();
  await expect(createMuxStream({ name: "x" })).rejects.toThrow(
    /Failed to create Mux stream: mux did not respond within 50ms/
  );
  expect(Date.now() - started).toBeLessThan(1_000);
  expect(signal?.aborted).toBe(true);
});

it("a Mux outage leaves Horizon's breaker closed", async () => {
  mockRetrieve.mockRejectedValue(muxError(502));
  for (let i = 0; i < 6; i++) {
    await getMuxLiveStreamState("s1");
  }
  expect(await getMuxBreaker().state()).toBe("open");
  expect(await getHorizonBreaker().state()).toBe("closed");
  await expect(
    getHorizonBreaker().execute(async () => "horizon ok")
  ).resolves.toBe("horizon ok");
});
