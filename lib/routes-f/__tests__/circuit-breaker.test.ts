import {
  __test__resetCircuitBreaker,
  getCircuitBreakerSnapshot,
  runWithCircuitBreaker,
} from "../circuit-breaker";

describe("routes-f circuit breaker", () => {
  beforeEach(() => {
    __test__resetCircuitBreaker();
  });

  it("stays closed after successful calls", async () => {
    const result = await runWithCircuitBreaker({
      key: "dep-a",
      now: 100,
      failureThreshold: 2,
      cooldownMs: 1000,
      action: async () => "ok",
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe("closed");

    const snapshot = getCircuitBreakerSnapshot("dep-a");
    expect(snapshot.state).toBe("closed");
    expect(snapshot.failures).toBe(0);
  });

  it("opens after threshold and short-circuits during cooldown", async () => {
    await runWithCircuitBreaker({
      key: "dep-b",
      now: 100,
      failureThreshold: 2,
      cooldownMs: 1000,
      action: async () => {
        throw new Error("fail-1");
      },
    });

    const secondFailure = await runWithCircuitBreaker({
      key: "dep-b",
      now: 200,
      failureThreshold: 2,
      cooldownMs: 1000,
      action: async () => {
        throw new Error("fail-2");
      },
    });

    expect(secondFailure.ok).toBe(false);
    expect(secondFailure.state).toBe("open");
    expect(secondFailure.shortCircuited).toBe(false);

    const shortCircuit = await runWithCircuitBreaker({
      key: "dep-b",
      now: 700,
      failureThreshold: 2,
      cooldownMs: 1000,
      action: async () => "unexpected",
    });

    expect(shortCircuit.ok).toBe(false);
    expect(shortCircuit.shortCircuited).toBe(true);
    expect(shortCircuit.state).toBe("open");
    expect(shortCircuit.retryAfterMs).toBeGreaterThan(0);
  });

  it("moves to half-open after cooldown and closes on recovery", async () => {
    await runWithCircuitBreaker({
      key: "dep-c",
      now: 100,
      failureThreshold: 2,
      cooldownMs: 1000,
      action: async () => {
        throw new Error("fail-1");
      },
    });

    await runWithCircuitBreaker({
      key: "dep-c",
      now: 200,
      failureThreshold: 2,
      cooldownMs: 1000,
      action: async () => {
        throw new Error("fail-2");
      },
    });

    const recovered = await runWithCircuitBreaker({
      key: "dep-c",
      now: 1300,
      failureThreshold: 2,
      cooldownMs: 1000,
      action: async () => "ok",
    });

    expect(recovered.ok).toBe(true);
    expect(recovered.state).toBe("closed");

    const snapshot = getCircuitBreakerSnapshot("dep-c");
    expect(snapshot.state).toBe("closed");
    expect(snapshot.failures).toBe(0);
  });
});
