/**
 * @jest-environment node
 */
const replicaSql = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
  createPool: jest.fn(() => ({ sql: replicaSql })),
}));
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { NextResponse } from "next/server";
import { signToken, verifyToken } from "@/lib/auth/sign-token";
import { sql, createPool } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import {
  RECENT_WRITE_COOKIE,
  ReplicaUnavailableError,
  hasRecentWrite,
  isReplicaInfraError,
  loadReplicaConfig,
  markRecentWrite,
  readFromReplica,
  replicaUnavailableResponse,
  resetReplicaRouter,
  type SqlTag,
} from "@/lib/db/replica";

const primarySql = sql as unknown as jest.Mock;
const warn = logger.warn as jest.Mock;
const REPLICA_URL = "postgres://replica-pooler.example/db";

const ORIGINAL_ENV = process.env;

const SECRET = "SENTINEL-session-secret-for-tests";

function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: SECRET, ...env };
  resetReplicaRouter();
}

/** A signed read-your-own-writes marker for a write at `ms`. */
const marker = (ms: number, secret = SECRET) =>
  `${RECENT_WRITE_COOKIE}=${signToken({ w: ms }, secret)}`;

const isLagProbe = (strings: TemplateStringsArray) =>
  strings.join("?").includes("pg_last_xact_replay_timestamp");

/** Replica answers the lag probe with `lag` and every other query with rows. */
function replicaHealthy(lag: number | null = 0) {
  replicaSql.mockImplementation((strings: TemplateStringsArray) =>
    Promise.resolve(
      isLagProbe(strings)
        ? { rows: [{ lag_seconds: lag }] }
        : { rows: [{ source: "replica" }] }
    )
  );
}

const connectionError = () =>
  Object.assign(new Error("Connection terminated"), { code: "08006" });

function replicaDown() {
  replicaSql.mockImplementation((strings: TemplateStringsArray) =>
    isLagProbe(strings)
      ? Promise.resolve({ rows: [{ lag_seconds: 0 }] })
      : Promise.reject(connectionError())
  );
}

const query = (tag: SqlTag) =>
  tag`SELECT count(*) FROM users`.then(r => r.rows[0]);
const requestWithCookie = (cookie?: string) =>
  new Request("http://localhost/api/x", { headers: cookie ? { cookie } : {} });

beforeEach(() => {
  jest.clearAllMocks();
  primarySql.mockResolvedValue({ rows: [{ source: "primary" }] });
  setEnv({ POSTGRES_REPLICA_URL: REPLICA_URL });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("loadReplicaConfig", () => {
  it("has safe defaults and treats a blank URL as unconfigured", () => {
    expect(
      loadReplicaConfig({ POSTGRES_REPLICA_URL: "  " } as NodeJS.ProcessEnv)
    ).toEqual({
      url: undefined,
      maxLagSeconds: 30,
      fallbackConcurrency: 4,
      breakerThreshold: 3,
      breakerCooldownMs: 30_000,
      lagProbeTtlMs: 5_000,
      queryTimeoutMs: 5_000,
      readYourWritesSeconds: 30,
      slowQueryMs: 500,
    });
  });

  it("ignores malformed numbers and ties the read-your-writes window to max lag", () => {
    const config = loadReplicaConfig({
      DB_REPLICA_MAX_LAG_SECONDS: "10",
      DB_REPLICA_FALLBACK_CONCURRENCY: "-2",
      DB_REPLICA_BREAKER_THRESHOLD: "0",
    } as NodeJS.ProcessEnv);

    expect(config.maxLagSeconds).toBe(10);
    expect(config.readYourWritesSeconds).toBe(10);
    expect(config.fallbackConcurrency).toBe(4);
    expect(config.breakerThreshold).toBe(1);
  });
});

describe("routing", () => {
  it("uses the primary and never builds a pool when no replica is configured", async () => {
    setEnv({ POSTGRES_REPLICA_URL: undefined });

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "primary",
    });
    expect(createPool).not.toHaveBeenCalled();
  });

  it("refuses a non-pooled replica URL and stays on the primary", async () => {
    setEnv({
      POSTGRES_REPLICA_URL: "postgres://u:p@ep-replica.example.neon.tech/db",
    });

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "primary",
    });
    expect(createPool).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "db.replica.misconfigured",
      expect.any(Object)
    );
  });

  it("accepts a localhost replica URL for local testing", async () => {
    setEnv({ POSTGRES_REPLICA_URL: "postgres://u:p@localhost:55433/db" });
    replicaHealthy(0);

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "replica",
    });
  });

  it("uses the replica when it is healthy and caught up", async () => {
    replicaHealthy(2);

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "replica",
    });
    expect(primarySql).not.toHaveBeenCalled();
    expect(createPool).toHaveBeenCalledWith({ connectionString: REPLICA_URL });
  });

  it("probes lag once per TTL window, not per query", async () => {
    replicaHealthy(0);

    await readFromReplica("t", query);
    await readFromReplica("t", query);
    await Promise.all([
      readFromReplica("t", query),
      readFromReplica("t", query),
    ]);

    const probes = replicaSql.mock.calls.filter(([s]) => isLagProbe(s));
    expect(probes).toHaveLength(1);
  });

  it("falls back to the primary when lag exceeds the threshold", async () => {
    replicaHealthy(31);

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "primary",
    });
    expect(warn).toHaveBeenCalledWith(
      "db.replica.lag_exceeded",
      expect.objectContaining({ lagSeconds: 31, maxLagSeconds: 30 })
    );
    expect(warn).toHaveBeenCalledWith("db.replica.fallback", {
      label: "t",
      reason: "lag",
    });
  });

  it("treats a replica that cannot report lag as unhealthy", async () => {
    replicaHealthy(null);

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "primary",
    });
  });

  it("routes a caller who just wrote to the primary (read your own writes)", async () => {
    replicaHealthy(0);
    const request = requestWithCookie(marker(Date.now() - 1000));

    await expect(readFromReplica("t", query, { request })).resolves.toEqual({
      source: "primary",
    });
    expect(replicaSql).not.toHaveBeenCalled();
  });

  it("returns to the replica once the read-your-writes window has passed", async () => {
    replicaHealthy(0);
    const request = requestWithCookie(marker(Date.now() - 31_000));

    await expect(readFromReplica("t", query, { request })).resolves.toEqual({
      source: "replica",
    });
  });
});

describe("failure handling", () => {
  it("retries a connection failure on the primary", async () => {
    replicaDown();

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "primary",
    });
    expect(warn).toHaveBeenCalledWith("db.replica.fallback", {
      label: "t",
      reason: "replica-error",
    });
  });

  it("does not retry query bugs on the primary", async () => {
    replicaSql.mockImplementation((strings: TemplateStringsArray) =>
      isLagProbe(strings)
        ? Promise.resolve({ rows: [{ lag_seconds: 0 }] })
        : Promise.reject(
            Object.assign(new Error("column x does not exist"), {
              code: "42703",
            })
          )
    );

    await expect(readFromReplica("t", query)).rejects.toThrow(
      "column x does not exist"
    );
    expect(primarySql).not.toHaveBeenCalled();
  });

  it("never replays a write that reached the replica onto the primary", async () => {
    replicaSql.mockImplementation((strings: TemplateStringsArray) =>
      isLagProbe(strings)
        ? Promise.resolve({ rows: [{ lag_seconds: 0 }] })
        : Promise.reject(
            Object.assign(
              new Error("cannot execute INSERT in a read-only transaction"),
              {
                code: "25006",
              }
            )
          )
    );

    await expect(
      readFromReplica("t", tag => tag`INSERT INTO t VALUES (1)`)
    ).rejects.toThrow(/read-only/);
    expect(primarySql).not.toHaveBeenCalled();
  });

  it("opens the breaker after repeated failures and stops calling the replica", async () => {
    replicaDown();

    for (let i = 0; i < 3; i++) {
      await readFromReplica("t", query);
    }
    const callsWhenOpened = replicaSql.mock.calls.length;
    await readFromReplica("t", query);

    expect(replicaSql.mock.calls.length).toBe(callsWhenOpened);
    expect(warn).toHaveBeenCalledWith(
      "db.replica.breaker_open",
      expect.objectContaining({ consecutiveFailures: 3 })
    );
    expect(warn).toHaveBeenLastCalledWith("db.replica.fallback", {
      label: "t",
      reason: "breaker-open",
    });
  });

  it("closes the breaker after the cooldown once the replica recovers", async () => {
    setEnv({
      POSTGRES_REPLICA_URL: REPLICA_URL,
      DB_REPLICA_BREAKER_COOLDOWN_MS: "0",
    });
    replicaDown();
    for (let i = 0; i < 3; i++) {
      await readFromReplica("t", query);
    }

    replicaHealthy(0);
    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "replica",
    });
  });

  it("caps concurrent fallbacks so a replica outage cannot flood the primary", async () => {
    setEnv({
      POSTGRES_REPLICA_URL: REPLICA_URL,
      DB_REPLICA_FALLBACK_CONCURRENCY: "2",
    });
    replicaHealthy(120); // lagging: every read wants to fall back
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => (release = resolve));
    primarySql.mockImplementation(() =>
      gate.then(() => ({ rows: [{ source: "primary" }] }))
    );

    const pending = Array.from({ length: 5 }, () =>
      readFromReplica("t", query)
    );
    const settledEarly = await Promise.allSettled(
      pending.map(p =>
        Promise.race([p, new Promise(r => setTimeout(() => r("pending"), 20))])
      )
    );
    release();
    const settled = await Promise.allSettled(pending);

    const rejected = settled.filter(s => s.status === "rejected");
    expect(rejected).toHaveLength(3);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(
        ReplicaUnavailableError
      );
    }
    expect(primarySql).toHaveBeenCalledTimes(2);
    expect(settledEarly.filter(s => s.status === "rejected")).toHaveLength(3);
    expect(warn).toHaveBeenCalledWith(
      "db.replica.fallback_rejected",
      expect.objectContaining({ cap: 2, reason: "lag" })
    );

    // Capacity is released once the in-flight fallbacks finish.
    primarySql.mockResolvedValue({ rows: [{ source: "primary" }] });
    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "primary",
    });
  });

  it("times out a hung replica query and falls back", async () => {
    setEnv({
      POSTGRES_REPLICA_URL: REPLICA_URL,
      DB_REPLICA_QUERY_TIMEOUT_MS: "20",
    });
    replicaSql.mockImplementation((strings: TemplateStringsArray) =>
      isLagProbe(strings)
        ? Promise.resolve({ rows: [{ lag_seconds: 0 }] })
        : new Promise(() => {})
    );

    await expect(readFromReplica("t", query)).resolves.toEqual({
      source: "primary",
    });
  });

  it("logs slow queries with the target that served them", async () => {
    setEnv({ POSTGRES_REPLICA_URL: REPLICA_URL, DB_SLOW_QUERY_MS: "0" });
    replicaHealthy(0);

    await readFromReplica("admin.counts", query);

    expect(warn).toHaveBeenCalledWith(
      "db.slow_query",
      expect.objectContaining({
        label: "admin.counts",
        target: "replica",
        reason: "healthy",
      })
    );
  });
});

describe("isReplicaInfraError", () => {
  it.each([
    ["connection exception", { code: "08006", message: "x" }, true],
    ["admin shutdown", { code: "57P01", message: "x" }, true],
    ["too many connections", { code: "53300", message: "x" }, true],
    [
      "recovery conflict",
      {
        code: "40001",
        message: "canceling statement due to conflict with recovery",
      },
      true,
    ],
    [
      "serialization failure (not a replica issue)",
      { code: "40001", message: "could not serialize" },
      false,
    ],
    ["undefined column", { code: "42703", message: "x" }, false],
    ["read-only transaction", { code: "25006", message: "x" }, false],
    ["node errno", { code: "ECONNREFUSED", message: "x" }, true],
    ["socket message", { message: "WebSocket was closed" }, true],
    ["plain bug", { message: "Cannot read properties of undefined" }, false],
  ])("%s → %s", (_name, fields, expected) => {
    expect(
      isReplicaInfraError(Object.assign(new Error(fields.message), fields))
    ).toBe(expected);
  });

  it("ignores non-Error values", () => {
    expect(isReplicaInfraError("boom")).toBe(false);
  });
});

describe("read-your-own-writes marker", () => {
  it("sets a signed httpOnly cookie lasting the configured window", () => {
    const res = markRecentWrite(
      NextResponse.json({ ok: true }),
      1_700_000_000_000
    );
    const cookie = res.cookies.get(RECENT_WRITE_COOKIE);

    expect(cookie).toMatchObject({ httpOnly: true, path: "/", maxAge: 30 });
    expect(verifyToken(cookie!.value, SECRET)).toEqual({
      w: 1_700_000_000_000,
    });
  });

  it("issues nothing without SESSION_SECRET", () => {
    setEnv({ POSTGRES_REPLICA_URL: REPLICA_URL, SESSION_SECRET: undefined });

    const res = markRecentWrite(NextResponse.json({ ok: true }));

    expect(res.cookies.get(RECENT_WRITE_COOKIE)).toBeUndefined();
    expect(hasRecentWrite(requestWithCookie(marker(Date.now())))).toBe(false);
  });

  it.each([
    ["no cookie", undefined, false],
    ["fresh", marker(1_000_000 - 5_000), true],
    ["expired", marker(1_000_000 - 30_000), false],
    ["from the future", marker(1_000_000 + 60_000), false],
    ["among other cookies", `a=1; ${marker(1_000_000)}; b=2`, true],
    ["garbage", `${RECENT_WRITE_COOKIE}=abc`, false],
    [
      "unsigned timestamp (forged)",
      `${RECENT_WRITE_COOKIE}=${1_000_000}`,
      false,
    ],
    ["signed with another secret", marker(1_000_000, "SENTINEL-other"), false],
  ])("%s → %s", (_name, cookie, expected) => {
    expect(hasRecentWrite(requestWithCookie(cookie), 1_000_000)).toBe(expected);
  });
});

describe("replicaUnavailableResponse", () => {
  it("is a retryable 503", () => {
    const res = replicaUnavailableResponse();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});
