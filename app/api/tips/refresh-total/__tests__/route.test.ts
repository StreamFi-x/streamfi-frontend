/**
 * @jest-environment node
 */
// Shared closures so the route, re-required per test, sees the same mocks.
const mockSql = jest.fn();
const mockVerifySession = jest.fn();
const mockHorizon = jest.fn();
const mockInvalidate = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));
jest.mock("@/lib/stellar/horizon", () => ({
  fetchPaymentsReceived: (...args: unknown[]) => mockHorizon(...args),
}));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: async () => undefined,
}));
jest.mock("@/lib/routes-f/price", () => ({ getXlmUsdPrice: async () => 0.1 }));
jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: (...args: unknown[]) => mockInvalidate(...args),
}));

import { NextRequest, NextResponse } from "next/server";

const sqlMock = mockSql;
const sessionMock = mockVerifySession;
const horizonMock = mockHorizon;
const invalidateUserCaches = mockInvalidate;

const CREATOR = {
  id: "creator-id",
  username: "creator",
  stellar_public_key: "GCREATOR",
  total_tips_received: "5.0000000",
  total_tips_count: 2,
  last_tip_at: "2026-01-01T00:00:00.000Z",
};

const tip = (n: number) => ({
  id: String(n),
  sender: `GSENDER${n}`,
  amount: "1.5",
  asset: "XLM",
  txHash: `tx${n}`,
  timestamp: `2026-09-0${n}T00:00:00Z`,
  ledger: n,
});

let POST: (req: NextRequest) => Promise<NextResponse>;
let now: number;

function loadRoute() {
  // Fresh limiter, cooldown and lock state per test.
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = require("../route").POST;
  });
}

function asUser(userId: string, extra: Record<string, unknown> = {}) {
  sessionMock.mockResolvedValue({
    ok: true,
    userId,
    wallet: null,
    privyId: null,
    username: null,
    email: null,
    ...extra,
  });
}

const request = (body: unknown = { username: "creator" }) =>
  new NextRequest("http://localhost/api/tips/refresh-total", {
    method: "POST",
    body: JSON.stringify(body),
  });

const statements = () =>
  sqlMock.mock.calls.map(([strings]) =>
    (strings as TemplateStringsArray).join("?").replace(/\s+/g, " ").trim()
  );

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.ADMIN_PRIVY_IDS;
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  sqlMock.mockReset().mockImplementation((strings: TemplateStringsArray) =>
    Promise.resolve({
      rows: strings.join("").includes("FROM users") ? [{ ...CREATOR }] : [],
    })
  );
  horizonMock
    .mockReset()
    .mockResolvedValueOnce({ tips: [tip(2), tip(1)], nextCursor: "c1" })
    .mockResolvedValueOnce({ tips: [tip(3)], nextCursor: "c2" })
    .mockResolvedValueOnce({ tips: [], nextCursor: undefined });
  invalidateUserCaches.mockReset().mockResolvedValue(undefined);
  loadRoute();
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/tips/refresh-total", () => {
  it("requires a session", async () => {
    sessionMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    expect((await POST(request())).status).toBe(401);
    expect(horizonMock).not.toHaveBeenCalled();
  });

  it("rejects a missing username", async () => {
    asUser(CREATOR.id);
    expect((await POST(request({}))).status).toBe(400);
  });

  it("returns 404 for an unknown creator", async () => {
    asUser(CREATOR.id);
    sqlMock.mockResolvedValue({ rows: [] });
    expect((await POST(request({ username: "ghost" }))).status).toBe(404);
  });

  it("forbids refreshing someone else's totals", async () => {
    asUser("someone-else");
    expect((await POST(request())).status).toBe(403);
    expect(horizonMock).not.toHaveBeenCalled();
  });

  it("lets the owner refresh: walks every page, one insert per page, updates and invalidates", async () => {
    asUser(CREATOR.id);
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      username: "creator",
      totalReceived: "4.5000000",
      totalCount: 3,
      lastTipAt: "2026-09-02T00:00:00Z",
      refreshed: true,
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");

    expect(horizonMock).toHaveBeenCalledTimes(3);
    const inserts = statements().filter(s =>
      s.startsWith("INSERT INTO tip_transactions")
    );
    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toContain(
      "ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING"
    );
    const [, , , page1] = sqlMock.mock.calls.find(([s]) =>
      (s as TemplateStringsArray)
        .join("")
        .includes("INSERT INTO tip_transactions")
    )!;
    expect(JSON.parse(page1 as string)).toHaveLength(2);
    expect(statements().some(s => s.startsWith("UPDATE users"))).toBe(true);
    expect(invalidateUserCaches).toHaveBeenCalledWith({
      id: CREATOR.id,
      username: "creator",
      wallet: "GCREATOR",
    });
  });

  it("lets an admin refresh another creator", async () => {
    process.env.ADMIN_PRIVY_IDS = "did:privy:admin";
    asUser("admin-user-id", { privyId: "did:privy:admin" });
    expect((await POST(request())).status).toBe(200);
  });

  it("reuses a refresh finished within the last minute instead of rerunning it", async () => {
    asUser(CREATOR.id);
    await POST(request());
    horizonMock.mockClear();

    now += 30_000;
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      refreshed: false,
      totalReceived: "5.0000000",
      totalCount: 2,
      retryAfter: 30,
    });
    expect(horizonMock).not.toHaveBeenCalled();
  });

  it("never runs two refreshes of the same creator at once", async () => {
    asUser(CREATOR.id);
    let finishFirst!: () => void;
    horizonMock.mockReset().mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishFirst = () => resolve({ tips: [], nextCursor: undefined });
        })
    );

    const first = POST(request());
    while (horizonMock.mock.calls.length === 0) {
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
    expect(await overlapping.json()).toMatchObject({ retryAfter: 10 });

    finishFirst();
    expect((await first).status).toBe(200);
    expect(horizonMock).toHaveBeenCalledTimes(1);
  });

  it("returns 429 with retry guidance once a caller exceeds 10 refreshes per 10 minutes", async () => {
    asUser(CREATOR.id);
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
    asUser(CREATOR.id);
    for (let i = 0; i < 11; i += 1) {
      await POST(request());
    }
    process.env.ADMIN_PRIVY_IDS = "did:privy:admin";
    asUser("admin-user-id", { privyId: "did:privy:admin" });
    expect((await POST(request())).status).toBe(200);
  });

  it("releases the lock when the Horizon walk fails", async () => {
    asUser(CREATOR.id);
    horizonMock.mockReset().mockRejectedValueOnce(new Error("horizon 503"));
    expect((await POST(request())).status).toBe(500);

    horizonMock.mockResolvedValue({ tips: [], nextCursor: undefined });
    now += 61_000;
    expect((await POST(request())).status).toBe(200);
  });
});
