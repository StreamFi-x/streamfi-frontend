/**
 * reports/stream/submit route tests (#1447).
 * Covers the identity/rate-limit wiring around assessReportAbuse: session
 * derives the reporter (never a client-supplied field), per-account limiting
 * applies only to authenticated reporters, and flags get persisted alongside
 * the report.
 */

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/lib/stream/report-abuse-detection", () => ({
  assessReportAbuse: jest.fn(),
}));

// route.ts calls createRateLimiter(...) twice at module scope: first for the
// IP limiter, then the account limiter. jest.mock is hoisted above regular
// declarations, so the two per-call mocks are built inline in the factory
// rather than referencing outer-scope consts (which would still be
// undefined at hoist time).
jest.mock("@/lib/rate-limit", () => {
  const limiters = [
    jest.fn().mockResolvedValue(false),
    jest.fn().mockResolvedValue(false),
  ];
  let callIndex = 0;
  return {
    createRateLimiter: jest.fn(() => limiters[callIndex++]),
    __limiters: limiters,
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __limiters } = jest.requireMock("@/lib/rate-limit") as {
  __limiters: [jest.Mock, jest.Mock];
};
const [ipLimiterMock, accountLimiterMock] = __limiters;

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { assessReportAbuse } from "@/lib/stream/report-abuse-detection";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const assessReportAbuseMock = assessReportAbuse as jest.Mock;

const makeRequest = (body: object) =>
  new Request("http://localhost/api/admin/reports/stream/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

let consoleErrorSpy: jest.SpyInstance;

describe("POST /api/admin/reports/stream/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ipLimiterMock.mockResolvedValue(false);
    accountLimiterMock.mockResolvedValue(false);
    assessReportAbuseMock.mockResolvedValue({ priority: "normal", flags: [] });
    sqlMock.mockResolvedValue({ rows: [{ id: "report-1" }] });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("stores an anonymous report when there is no session, ignoring any client-supplied reporter_id", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest({
      stream_id: "s1",
      streamer: "someone",
      reason: "harassment",
      reporter_id: "spoofed-fake-id",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(assessReportAbuseMock).toHaveBeenCalledWith(
      expect.objectContaining({ reporterUserId: null })
    );
    const insertArgs = sqlMock.mock.calls[0];
    expect(insertArgs.flat()).not.toContain("spoofed-fake-id");
    expect(accountLimiterMock).not.toHaveBeenCalled();
  });

  it("derives the reporter identity from the session, never the request body", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "real-user-id",
      wallet: "GOWNER0000000000000000000000000000000000000000000000000",
      privyId: null,
      username: "owner",
      email: null,
    });

    const req = makeRequest({
      stream_id: "s1",
      streamer: "someone",
      reason: "harassment",
      reporter_id: "spoofed-fake-id",
    });
    await POST(req);

    expect(assessReportAbuseMock).toHaveBeenCalledWith(
      expect.objectContaining({ reporterUserId: "real-user-id" })
    );
    const insertArgs = sqlMock.mock.calls[0].flat();
    expect(insertArgs).toContain("real-user-id");
    expect(insertArgs).not.toContain("spoofed-fake-id");
  });

  it("rate-limits an authenticated reporter per account, independent of IP", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "real-user-id",
      wallet: "GOWNER0000000000000000000000000000000000000000000000000",
      privyId: null,
      username: "owner",
      email: null,
    });
    accountLimiterMock.mockResolvedValue(true);

    const req = makeRequest({
      stream_id: "s1",
      streamer: "someone",
      reason: "harassment",
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("persists every returned flag alongside the report", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(),
    });
    assessReportAbuseMock.mockResolvedValue({
      priority: "expedited",
      flags: [
        { signal: "volume_spike", detail: { recentCount: 10 } },
        { signal: "coordinated_accounts", detail: { mutualFollow: true } },
      ],
    });

    const req = makeRequest({
      stream_id: "s1",
      streamer: "someone",
      reason: "harassment",
    });
    await POST(req);

    // 1 insert for the report + 2 for the flags.
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });
});
