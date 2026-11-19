import { act, renderHook } from "@testing-library/react";
import {
  RetryableRequestError,
  useIdempotentMutation,
} from "@/hooks/useIdempotentMutation";

function reply(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return {
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name] ?? null },
  } as unknown as Response;
}

describe("useIdempotentMutation", () => {
  const fetchMock = jest.fn();
  let uuid = 0;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.sessionStorage.clear();
    uuid = 0;
    Object.defineProperty(global, "crypto", {
      value: { randomUUID: () => `uuid-${++uuid}` },
      configurable: true,
    });
  });

  const sentKeys = () =>
    fetchMock.mock.calls.map(call => call[1].headers["Idempotency-Key"]);

  it("reuses one key across retries until the operation completes", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(reply(503, { error: "down" }))
      .mockResolvedValueOnce(
        reply(409, { error: "idempotency_request_in_progress" })
      )
      .mockResolvedValueOnce(
        reply(201, { payout: { id: "p1" } }, { "Idempotency-Replayed": "true" })
      );
    const { result } = renderHook(() =>
      useIdempotentMutation("/api/routes-f/payouts", "payout")
    );

    for (let i = 0; i < 3; i++) {
      await expect(
        result.current.mutate({ amount_usdc: 10 })
      ).rejects.toBeInstanceOf(RetryableRequestError);
    }
    let outcome;
    await act(async () => {
      outcome = await result.current.mutate({ amount_usdc: 10 });
    });

    expect(sentKeys()).toEqual(["uuid-1", "uuid-1", "uuid-1", "uuid-1"]);
    expect(outcome).toEqual({
      status: 201,
      data: { payout: { id: "p1" } },
      replayed: true,
    });
    expect(
      window.sessionStorage.getItem("streamfi:idempotency:payout")
    ).toBeNull();
  });

  it("starts a new logical operation after a final answer", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(201, {}))
      .mockResolvedValueOnce(reply(400, { error: "Insufficient USDC balance" }))
      .mockResolvedValueOnce(reply(201, {}));
    const { result } = renderHook(() => useIdempotentMutation("/x", "op"));

    await act(async () => {
      await result.current.mutate({});
      await result.current.mutate({});
      await result.current.mutate({});
    });

    expect(sentKeys()).toEqual(["uuid-1", "uuid-2", "uuid-3"]);
  });

  it("keeps the key across a page reload via sessionStorage only", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const first = renderHook(() => useIdempotentMutation("/x", "subscribe"));
    await expect(
      first.result.current.mutate({ tier: "basic" })
    ).rejects.toThrow();

    expect(
      window.sessionStorage.getItem("streamfi:idempotency:subscribe")
    ).toBe("uuid-1");
    expect(JSON.stringify(window.sessionStorage)).not.toContain("basic");

    fetchMock.mockResolvedValueOnce(reply(201, {}));
    const reloaded = renderHook(() => useIdempotentMutation("/x", "subscribe"));
    await act(async () => {
      await reloaded.result.current.mutate({ tier: "basic" });
    });
    expect(sentKeys()).toEqual(["uuid-1", "uuid-1"]);
  });

  it("switches to a fresh key when the stored one belonged to a different request", async () => {
    window.sessionStorage.setItem("streamfi:idempotency:op", "stale-key");
    fetchMock
      .mockResolvedValueOnce(reply(422, { error: "idempotency_key_reused" }))
      .mockResolvedValueOnce(reply(201, {}));
    const { result } = renderHook(() => useIdempotentMutation("/x", "op"));

    await act(async () => {
      await result.current.mutate({ amount: 2 });
    });

    expect(sentKeys()).toEqual(["stale-key", "uuid-1"]);
  });

  it("does not create a new key on re-render", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { result, rerender } = renderHook(() =>
      useIdempotentMutation("/x", "op")
    );

    await expect(result.current.mutate({})).rejects.toThrow();
    rerender();
    await expect(result.current.mutate({})).rejects.toThrow();

    expect(sentKeys()).toEqual(["uuid-1", "uuid-1"]);
  });
});
