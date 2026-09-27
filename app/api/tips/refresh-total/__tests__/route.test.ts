/**
 * @jest-environment node
 */
// Shared closures so the route, re-required per test (fresh limiter, cooldown
// and lock state), sees the same mocks.
const mockSql = jest.fn();
const mockVerifySession = jest.fn();
const mockReconcile = jest.fn();
const mockBadges = jest.fn();
const mockGetXlmUsdPrice = jest.fn();
const mockDispatch = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: (...args: unknown[]) => mockBadges(...args),
}));
jest.mock("@/lib/routes-f/price", () => ({
  getXlmUsdPrice: mockGetXlmUsdPrice,
}));
jest.mock("@/lib/jobs/qstash", () => ({
  dispatchJob: (...args: unknown[]) => mockDispatch(...args),
}));
jest.mock("@/lib/stellar/tip-reconciliation", () => ({
  ...jest.requireActual("@/lib/stellar/tip-reconciliation"),
  reconcileUserTipTotals: (...args: unknown[]) => mockReconcile(...args),
}));

import { NextRequest, NextResponse } from "next/server";

const USER = {
  id: "user-1",
  username: "alice",
  stellar_public_key: "GALICE",
  total_tips_received: "5.0000000",
  total_tips_count: 2,
  last_tip_at: "2026-01-01T00:00:00.000Z",
};

const UPDATED = {
  status: "complete",
  totals: {
    totalReceived: "12.5000000",
    totalCount: 3,
    lastTipAt: "2026-09-01T00:00:00Z",
  },
};

let POST: (req: NextRequest) => Promise<NextResponse>;
// From the same module registry as the route, so instanceof holds.
let breakerErrors: typeof import("@/lib/resilience/circuit-breaker");
let now: number;

function asUser(userId: string, extra: Record<string, unknown> = {}) {
  mockVerifySession.mockResolvedValue({
    ok: true,
    userId,
    wallet: null,
    privyId: null,
    username: null,
    email: null,
    ...extra,
  });
}

const request = (body: unknown = { username: "alice" }) =>
  new NextRequest("http://localhost/api/tips/refresh-total", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.ADMIN_PRIVY_IDS;
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockSql.mockReset().mockResolvedValue({ rows: [{ ...USER }] });
  mockReconcile.mockReset().mockResolvedValue(UPDATED);
  mockBadges.mockReset().mockResolvedValue(undefined);
  mockDispatch
    .mockReset()
    .mockResolvedValue({ dispatched: true, messageId: "msg-1" });
  asUser(USER.id);
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = require("../route").POST;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    breakerErrors = require("@/lib/resilience/circuit-breaker");
  });
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/tips/refresh-total", () => {
  it("requires a session", async () => {
    mockVerifySession.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    expect((await POST(request())).status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("requires a username", async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it("returns 404 for an unknown user", async () => {
    mockSql.mockResolvedValue({ rows: [] });
    expect((await POST(request({ username: "nobody" }))).status).toBe(404);
  });

  it("returns 400 when the user has no wallet", async () => {
    mockSql.mockResolvedValue({ rows: [{ ...USER, stellar_public_key: "" }] });
    expect((await POST(request())).status).toBe(400);
  });

  it("forbids refreshing someone else's totals", async () => {
    asUser("someone-else");
    expect((await POST(request())).status).toBe(403);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("lets an admin refresh another creator", async () => {
    process.env.ADMIN_PRIVY_IDS = "did:privy:admin";
    asUser("admin-user-id", { privyId: "did:privy:admin" });
    expect((await POST(request())).status).toBe(200);
  });

  it("marks the caller for read-your-own-writes on a successful refresh", async () => {
    // tip_transactions feed replica-routed analytics (lib/db/replica.ts).
    process.env.SESSION_SECRET = "SENTINEL-session-secret-for-tests";
    try {
      const res = await POST(request());

      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie") ?? "").toContain("sf_recent_write=");
    } finally {
      delete process.env.SESSION_SECRET;
    }
  });

  it("does not mark the caller when the refresh is refused", async () => {
    process.env.SESSION_SECRET = "SENTINEL-session-secret-for-tests";
    try {
      asUser("someone-else");
      const res = await POST(request());

      expect(res.status).toBe(403);
      expect(res.headers.get("set-cookie")).toBeNull();
    } finally {
      delete process.env.SESSION_SECRET;
    }
  });

  it("recalculates through the shared ledger logic and keeps the response shape", async () => {
    const res = await POST(request({ username: "Alice" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        username: "alice",
        totalReceived: "12.5000000",
        totalCount: 3,
        lastTipAt: "2026-09-01T00:00:00Z",
        refreshed: true,
      })
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockReconcile).toHaveBeenCalledWith("user-1", "GALICE", {
      getXlmUsdPrice: mockGetXlmUsdPrice,
      maxPages: 10,
      timeBudgetMs: 6_000,
    });
    expect(mockBadges).toHaveBeenCalledWith("user-1");
  });

  it("returns 409 when concurrent writers kept winning", async () => {
    mockReconcile.mockResolvedValue({ status: "stale", totals: null });
    const res = await POST(request());
    expect(res.status).toBe(409);
    expect(res.headers.get("Retry-After")).toBe("10");
  });

  it("returns 409 when another worker is advancing the same creator", async () => {
    mockReconcile.mockResolvedValue({ status: "superseded", totals: null });
    expect((await POST(request())).status).toBe(409);
  });

  it("hands a history too long for one request to the background job", async () => {
    mockReconcile.mockResolvedValue({
      status: "in_progress",
      cursor: "cursor-42",
      totals: { totalReceived: "3.0000000", totalCount: 1, lastTipAt: null },
    });

    const res = await POST(request());

    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({
      refreshed: false,
      status: "in_progress",
      continuesInBackground: true,
      // The stored totals, never the partial walk's.
      totalReceived: "5.0000000",
      totalCount: 2,
    });
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "tip-refresh-creator" }),
      { userId: "user-1" },
      { deduplicationId: "tip-refresh-creator:user-1:cursor-42" }
    );
    expect(mockBadges).not.toHaveBeenCalled();
  });

  it("still answers 202 when background jobs are not configured", async () => {
    mockReconcile.mockResolvedValue({ status: "in_progress", cursor: null });
    mockDispatch.mockResolvedValue({
      dispatched: false,
      reason: "not_configured",
    });
    const res = await POST(request());
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ continuesInBackground: false });
  });

  it("fails fast with 503 while Horizon's circuit is open", async () => {
    mockReconcile.mockResolvedValue({
      status: "interrupted",
      error: new breakerErrors.CircuitOpenError("horizon", 12_300),
    });
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("13");
  });

  it("returns 503 when Horizon times out mid-walk", async () => {
    mockReconcile.mockResolvedValue({
      status: "interrupted",
      error: new breakerErrors.DownstreamTimeoutError("horizon", 8_000),
    });
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("10");
  });

  it("returns 500 when the database fails", async () => {
    mockReconcile.mockRejectedValue(new Error("db down"));
    expect((await POST(request())).status).toBe(500);
  });

  it("reuses a refresh finished within the last minute instead of rerunning it", async () => {
    await POST(request());
    mockReconcile.mockClear();

    now += 30_000;
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      refreshed: false,
      totalReceived: "5.0000000",
      totalCount: 2,
      retryAfter: 30,
    });
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("never runs two ledger walks of the same creator at once", async () => {
    let finishFirst!: () => void;
    mockReconcile.mockReset().mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishFirst = () => resolve(UPDATED);
        })
    );

    const first = POST(request());
    while (mockReconcile.mock.calls.length === 0) {
      await new Promise(r => setTimeout(r, 1));
    }

    // The cooldown answers with stored totals while the first walk runs.
    const immediate = await POST(request());
    expect(await immediate.json()).toMatchObject({ refreshed: false });

    finishFirst();
    expect((await first).status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it("returns 429 with retry guidance once a caller exceeds 10 refreshes per 10 minutes", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await POST(request())).status).toBe(200);
    }
    const limited = await POST(request());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({
      error: "Too many refresh requests",
    });
  });

  it("limits callers independently", async () => {
    for (let i = 0; i < 11; i += 1) {
      await POST(request());
    }
    process.env.ADMIN_PRIVY_IDS = "did:privy:admin";
    asUser("admin-user-id", { privyId: "did:privy:admin" });
    expect((await POST(request())).status).toBe(200);
  });

  it("releases the lock when the ledger walk fails", async () => {
    mockReconcile.mockRejectedValueOnce(new Error("horizon 503"));
    expect((await POST(request())).status).toBe(500);

    now += 61_000;
    expect((await POST(request())).status).toBe(200);
  });
});
