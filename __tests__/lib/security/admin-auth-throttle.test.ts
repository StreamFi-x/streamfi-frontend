/**
 * @jest-environment node
 *
 * Credential-stuffing simulations against the real admin entry points
 * (GET /api/admin/me, a role-gated routes-f admin route, and the cron
 * internal-secret path), exercising lib/security/admin-auth-throttle.ts.
 */

const cookieJar: Record<string, string> = {};
const headerJar: Record<string, string> = {};

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar[name] ? { value: cookieJar[name] } : undefined,
  }),
  headers: async () => new Headers(headerJar),
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/sessions/user-sessions", () => ({
  ...jest.requireActual("@/lib/sessions/user-sessions"),
  findActiveSession: jest.fn(),
  touchSession: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { findActiveSession } from "@/lib/sessions/user-sessions";
import { GET as adminMe } from "@/app/api/admin/me/route";
import { GET as adminUserSearch } from "@/app/api/routes-f/admin-user-search/route";
import { verifySession } from "@/lib/auth/verify-session";
import { requireAdminSecret } from "@/lib/admin-auth";
import {
  ADMIN_AUTH_POLICY,
  adminBlockDurationMs,
} from "@/lib/security/admin-auth-throttle";
import {
  MemoryKvStore,
  setSecurityKvStoreForTesting,
  type SecurityKvStore,
} from "@/lib/security/kv-store";

const ADMIN_DID = "did:privy:admin-legit";
const findActiveSessionMock = findActiveSession as jest.Mock;
const sqlMock = sql as unknown as jest.Mock;
const fetchMock = jest.fn();

let clock = 1_700_000_000_000;
const advance = (ms: number) => {
  clock += ms;
};

function as(ip: string, privySession?: string) {
  for (const k of Object.keys(cookieJar)) {
    delete cookieJar[k];
  }
  headerJar["x-real-ip"] = ip;
  if (privySession) {
    cookieJar.privy_session = privySession;
  }
}

function alertBodies(): string[] {
  return fetchMock.mock.calls.map(
    ([, init]) => JSON.parse((init as RequestInit).body as string).text
  );
}

const ORIGINAL_ENV = process.env;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let logSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  clock = 1_700_000_000_000;
  setSecurityKvStoreForTesting(new MemoryKvStore(() => clock));
  process.env = {
    ...ORIGINAL_ENV,
    ADMIN_PRIVY_IDS: ADMIN_DID,
    OPS_ALERT_WEBHOOK_URL: "https://hooks.example.test/alerts",
    OPS_ALERT_HOURLY_BUDGET: "50",
  };
  fetchMock.mockResolvedValue(new Response("ok"));
  global.fetch = fetchMock as unknown as typeof fetch;
  findActiveSessionMock.mockResolvedValue({
    id: "sess-1",
    user_id: "u-admin",
    last_seen_at: new Date(),
  });
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  logSpy.mockRestore();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  setSecurityKvStoreForTesting(null);
});

describe("admin backoff schedule", () => {
  it("is free for the first failures, then doubles up to a 1h cap", () => {
    expect(adminBlockDurationMs(1)).toBe(0);
    expect(adminBlockDurationMs(2)).toBe(0);
    expect(adminBlockDurationMs(3)).toBe(30_000);
    expect(adminBlockDurationMs(4)).toBe(60_000);
    expect(adminBlockDurationMs(5)).toBe(120_000);
    expect(adminBlockDurationMs(9)).toBe(32 * 60_000);
    expect(adminBlockDurationMs(10)).toBe(ADMIN_AUTH_POLICY.maxBlockMs);
    expect(adminBlockDurationMs(500)).toBe(ADMIN_AUTH_POLICY.maxBlockMs);
  });
});

describe("GET /api/admin/me (privy_session allowlist)", () => {
  it("allows a legitimate admin with an active session", async () => {
    as("203.0.113.10", ADMIN_DID);
    const res = await adminMe();
    expect(res.status).toBe(200);
  });

  it("rejects an allowlisted admin whose session was revoked", async () => {
    findActiveSessionMock.mockResolvedValueOnce(null);
    as("203.0.113.10", ADMIN_DID);
    const res = await adminMe();
    expect(res.status).toBe(401);
  });

  it("throttles repeated failures from one IP with escalating backoff", async () => {
    const ip = "198.51.100.7";
    const retryAfters: Array<string | null> = [];

    // Credential stuffing: a new guessed DID on every attempt.
    for (let i = 0; i < 3; i++) {
      as(ip, `did:privy:guess-${i}`);
      expect((await adminMe()).status).toBe(401);
    }

    for (let round = 0; round < 4; round++) {
      as(ip, `did:privy:blocked-${round}`);
      const blocked = await adminMe();
      expect(blocked.status).toBe(429);
      retryAfters.push(blocked.headers.get("Retry-After"));

      advance(Number(blocked.headers.get("Retry-After")) * 1000);
      as(ip, `did:privy:after-${round}`);
      expect((await adminMe()).status).toBe(401);
    }

    expect(retryAfters).toEqual(["30", "60", "120", "240"]);
  });

  it("rejects blocked attempts before doing any authentication work", async () => {
    const ip = "198.51.100.8";
    for (let i = 0; i < 3; i++) {
      as(ip, `did:privy:guess-${i}`);
      await adminMe();
    }
    findActiveSessionMock.mockClear();

    // Even the real admin DID from the blocked IP is not evaluated.
    as(ip, ADMIN_DID);
    const res = await adminMe();
    expect(res.status).toBe(429);
    expect(findActiveSessionMock).not.toHaveBeenCalled();
  });

  it("lets the admin back in after the cooldown and resets that IP's failures", async () => {
    const ip = "198.51.100.9";
    for (let i = 0; i < 3; i++) {
      as(ip, `did:privy:guess-${i}`);
      await adminMe();
    }
    as(ip, ADMIN_DID);
    expect((await adminMe()).status).toBe(429);

    advance(30_000);
    as(ip, ADMIN_DID);
    expect((await adminMe()).status).toBe(200);

    // Counter was reset: a single later typo is not immediately blocked.
    as(ip, "did:privy:typo");
    expect((await adminMe()).status).toBe(401);
    as(ip, "did:privy:typo-2");
    expect((await adminMe()).status).toBe(401);
  });

  it("blocks a credential sprayed from many IPs (credential scope)", async () => {
    const guessed = "did:privy:targeted-guess";
    for (let i = 0; i < 3; i++) {
      as(`192.0.2.${i + 1}`, guessed);
      expect((await adminMe()).status).toBe(401);
    }
    as("192.0.2.200", guessed);
    expect((await adminMe()).status).toBe(429);
  });

  it("never lets a parallel burst race past the block", async () => {
    const ip = "198.51.100.20";
    for (let i = 0; i < 2; i++) {
      as(ip, `did:privy:guess-${i}`);
      await adminMe();
    }

    as(ip, "did:privy:burst");
    const statuses = (
      await Promise.all(Array.from({ length: 25 }, () => adminMe()))
    ).map(r => r.status);

    // Only the one request that claimed the gate reaches authentication.
    expect(statuses.filter(s => s === 401)).toHaveLength(1);
    expect(statuses.filter(s => s === 429)).toHaveLength(24);
  });

  it("keeps multiple admin accounts independent of each other", async () => {
    process.env.ADMIN_PRIVY_IDS = `${ADMIN_DID},did:privy:admin-two`;
    for (let i = 0; i < 5; i++) {
      as("198.51.100.30", `did:privy:guess-${i}`);
      advance(10 * 60_000);
      await adminMe();
    }
    as("203.0.113.40", "did:privy:admin-two");
    expect((await adminMe()).status).toBe(200);
    as("203.0.113.41", ADMIN_DID);
    expect((await adminMe()).status).toBe(200);
  });

  it("fails closed with 503 when the throttle store is unavailable", async () => {
    const broken: SecurityKvStore = {
      incrWithTtl: jest.fn().mockRejectedValue(new Error("redis down")),
      setIfAbsent: jest.fn().mockRejectedValue(new Error("redis down")),
      set: jest.fn().mockRejectedValue(new Error("redis down")),
      get: jest.fn().mockRejectedValue(new Error("redis down")),
      ttlMs: jest.fn().mockRejectedValue(new Error("redis down")),
      del: jest.fn().mockRejectedValue(new Error("redis down")),
    };
    setSecurityKvStoreForTesting(broken);
    as("203.0.113.10", ADMIN_DID);
    const res = await adminMe();
    expect(res.status).toBe(503);
    expect(alertBodies().join("\n")).toContain("failing closed");
  });
});

describe("admin auth alerting", () => {
  async function fail(ip: string, times: number) {
    for (let i = 0; i < times; i++) {
      as(ip, `did:privy:${ip}-${i}`);
      const res = await adminMe();
      if (res.status === 429) {
        advance(Number(res.headers.get("Retry-After")) * 1000);
        as(ip, `did:privy:${ip}-${i}-retry`);
        await adminMe();
      }
    }
  }

  it("alerts once at the warning threshold and once more at critical", async () => {
    await fail("198.51.100.50", 4);
    expect(fetchMock).not.toHaveBeenCalled();

    await fail("198.51.100.50", 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(alertBodies()[0]).toContain("[WARNING]");
    expect(alertBodies()[0]).toContain("failed_attempts: 5");

    await fail("198.51.100.50", 4);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fail("198.51.100.50", 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(alertBodies()[1]).toContain("[CRITICAL]");
  });

  it("never includes the presented credential or raw IP in alerts", async () => {
    await fail("198.51.100.51", 5);
    const body = alertBodies().join("\n");
    expect(body).not.toContain("did:privy:");
    expect(body).not.toContain("198.51.100.51");
    expect(body).toContain("198.51.100.x");
    expect(body).toContain("mechanism: privy_session_allowlist");
    expect(body).toContain("route: admin/me");
  });

  it("does not generate unbounded alerts during a sustained attack", async () => {
    process.env.OPS_ALERT_HOURLY_BUDGET = "3";
    // 12 attacker IPs attacking in parallel, each crossing the warning
    // threshold (5 failures) within the same hour.
    const ips = Array.from({ length: 12 }, (_, n) => `10.0.${n}.1`);
    for (let round = 0; round < 5; round++) {
      for (const ip of ips) {
        as(ip, `did:privy:${ip}-${round}`);
        expect((await adminMe()).status).toBe(401);
      }
      advance(adminBlockDurationMs(round + 1));
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("raises a single distributed-attack alert when IPs and credentials rotate", async () => {
    for (let n = 0; n < ADMIN_AUTH_POLICY.globalAlertAt + 10; n++) {
      as(`172.16.${n}.9`, `did:privy:rotating-${n}`);
      expect((await adminMe()).status).toBe(401);
    }
    const distributed = alertBodies().filter(b =>
      b.includes("across all sources")
    );
    expect(distributed).toHaveLength(1);
  });
});

describe("other admin mechanisms share the guard", () => {
  function searchReq(ip: string) {
    return new NextRequest(
      "http://localhost/api/routes-f/admin-user-search?q=bob",
      {
        headers: { cookie: "privy_session=did:privy:regular", "x-real-ip": ip },
      }
    );
  }

  it("throttles a logged-in non-admin probing role-gated routes", async () => {
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join("?");
      if (q.includes("SELECT role")) {
        return { rows: [{ role: "user" }] };
      }
      return {
        rows: [
          {
            id: "u-regular",
            privy_id: "did:privy:regular",
            wallet: null,
            username: "regular",
            email: null,
          },
        ],
      };
    });

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await adminUserSearch(searchReq("198.51.100.60"))).status);
    }
    expect(statuses).toEqual([403, 403, 403, 429]);
  });

  it("leaves regular (non-admin) session auth untouched for a throttled IP", async () => {
    const ip = "198.51.100.61";
    for (let i = 0; i < 4; i++) {
      as(ip, `did:privy:guess-${i}`);
      await adminMe();
    }
    sqlMock.mockResolvedValue({
      rows: [
        {
          id: "u-regular",
          privy_id: "did:privy:regular",
          wallet: null,
          username: "regular",
          email: null,
        },
      ],
    });
    const session = await verifySession(searchReq(ip));
    expect(session.ok).toBe(true);
  });

  it("throttles guessing of the internal cron secret", async () => {
    process.env.INTERNAL_API_SECRET = "SENTINEL-internal-cron-secret";
    const req = (secret: string) =>
      new NextRequest("http://localhost/api/routes-f/cron", {
        headers: { "x-internal-secret": secret, "x-real-ip": "198.51.100.70" },
      });
    const opts = (r: NextRequest) =>
      requireAdminSecret(r, {
        mechanism: "internal_secret",
        route: "test",
        header: "x-internal-secret",
        secret: process.env.INTERNAL_API_SECRET,
      });

    const reasons: string[] = [];
    for (let i = 0; i < 4; i++) {
      const result = await opts(req(`wrong-${i}`));
      reasons.push(result.ok ? "ok" : result.reason);
    }
    expect(reasons).toEqual(["denied", "denied", "denied", "throttled"]);
    expect((await opts(req("SENTINEL-internal-cron-secret"))).ok).toBe(false);

    advance(30_000);
    expect((await opts(req("SENTINEL-internal-cron-secret"))).ok).toBe(true);
  });

  it("never matches when the shared secret is unset", async () => {
    delete process.env.INTERNAL_API_SECRET;
    const result = await requireAdminSecret(
      new NextRequest("http://localhost/x", {
        headers: { "x-internal-secret": "", "x-real-ip": "198.51.100.71" },
      }),
      {
        mechanism: "internal_secret",
        route: "test",
        header: "x-internal-secret",
        secret: undefined,
      }
    );
    expect(result.ok).toBe(false);
  });
});
