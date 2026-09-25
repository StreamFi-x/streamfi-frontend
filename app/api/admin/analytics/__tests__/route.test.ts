/**
 * @jest-environment node
 */
const mockSql = jest.fn();
const mockAdminId = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));
jest.mock("@/lib/admin-auth", () => ({
  getAdminIdentity: () => mockAdminId(),
  adminUnauthorized: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }));

const STATS_ROW = {
  total_users: "10",
  live_now: "2",
  pending_stream_reports: "1",
  pending_bug_reports: "0",
  new_users_7d: "3",
  total_categories: "8",
};

let GET: () => Promise<Response>;
let now: number;

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockSql.mockReset().mockResolvedValue({ rows: [STATS_ROW] });
  mockAdminId.mockReset().mockResolvedValue("did:privy:admin-1");
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GET = require("../route").GET;
  });
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/admin/analytics", () => {
  it("rejects non-admins before touching the database", async () => {
    mockAdminId.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("returns the stats as private, never shared-cacheable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      totalUsers: 10,
      liveNow: 2,
      pendingStreamReports: 1,
      pendingBugReports: 0,
      newUsers7d: 3,
      totalCategories: 8,
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
  });

  it("runs the COUNT scans at most once per 30s however many admins poll", async () => {
    for (const admin of ["a", "b", "c"]) {
      mockAdminId.mockResolvedValue(`did:privy:${admin}`);
      await GET();
      await GET();
    }
    expect(mockSql).toHaveBeenCalledTimes(1);

    now += 30_000;
    await GET();
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("allows a dashboard polling every 30s plus manual refreshes", async () => {
    // 2 polls/min from the dashboard + 20 manual refreshes in the same minute.
    const statuses = [];
    for (let i = 0; i < 22; i += 1) {
      statuses.push((await GET()).status);
    }
    expect(statuses.every(s => s === 200)).toBe(true);
  });

  it("returns 429 with Retry-After when one admin loops, without affecting another", async () => {
    const results = [];
    for (let i = 0; i < 31; i += 1) {
      results.push(await GET());
    }
    const limited = results[30];
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThanOrEqual(
      1
    );
    expect(await limited.json()).toMatchObject({ error: "Too many requests" });

    mockAdminId.mockResolvedValue("did:privy:admin-2");
    expect((await GET()).status).toBe(200);
  });

  it("recovers once the window passes", async () => {
    for (let i = 0; i < 31; i += 1) {
      await GET();
    }
    now += 60_000;
    expect((await GET()).status).toBe(200);
  });

  it("returns 500 without leaking database details", async () => {
    mockSql.mockRejectedValue(new Error("relation bug_reports does not exist"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
