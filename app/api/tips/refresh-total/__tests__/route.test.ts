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
jest.mock("@/lib/stellar/tip-reconciliation", () => ({
  ...jest.requireActual("@/lib/stellar/tip-reconciliation"),
  reconcileUserTipTotals: (...args: unknown[]) => mockReconcile(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { LedgerHistoryTooLargeError } from "@/lib/stellar/tip-reconciliation";

const USER = {
  id: "user-1",
  username: "alice",
  stellar_public_key: "GALICE",
  total_tips_received: "5.0000000",
  total_tips_count: 2,
  last_tip_at: "2026-01-01T00:00:00.000Z",
};

const UPDATED = {
  status: "updated",
  totals: {
    totalReceived: "12.5000000",
    totalCount: 3,
    lastTipAt: "2026-09-01T00:00:00Z",
  },
};

let POST: (req: NextRequest) => Promise<NextResponse>;
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
  asUser(USER.id);
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = require("../route").POST;
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
      maxAttempts: 3,
    });
    expect(mockBadges).toHaveBeenCalledWith("user-1");
  });

  it("returns 409 when concurrent writers kept winning", async () => {
    mockReconcile.mockResolvedValue({ status: "stale", totals: null });
    const res = await POST(request());
    expect(res.status).toBe(409);
    expect(res.headers.get("Retry-After")).toBe("10");
  });

  it("returns 422 instead of a partial total for an oversized history", async () => {
    mockReconcile.mockRejectedValue(new LedgerHistoryTooLargeError(100));
    expect((await POST(request())).status).toBe(422);
  });

  it("returns 500 when Horizon fails", async () => {
    mockReconcile.mockRejectedValue(new Error("horizon down"));
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

    // Immediately: the cooldown answers with stored totals.
    const immediate = await POST(request());
    expect(await immediate.json()).toMatchObject({ refreshed: false });

    // After the cooldown but while the first walk is still running: 409.
    now += 61_000;
    const overlapping = await POST(request());
    expect(overlapping.status).toBe(409);
    expect(overlapping.headers.get("Retry-After")).toBe("10");

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
