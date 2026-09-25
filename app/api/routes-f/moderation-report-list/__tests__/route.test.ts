/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureModerationReportListDependencies: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const CHANNEL_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function mockSession(overrides?: Partial<{ userId: string }>) {
  verifySessionMock.mockResolvedValue({
    ok: true,
    userId: overrides?.userId ?? CHANNEL_ID,
    wallet: null,
    privyId: "did:privy:abc",
    username: "creator",
    email: "creator@example.com",
  });
}

describe("routes-f moderation-report-list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const res = await GET(
      makeRequest(`/api/routes-f/moderation-report-list?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when channel is missing or not a UUID", async () => {
    mockSession();

    const res = await GET(
      makeRequest("/api/routes-f/moderation-report-list?channel=not-a-uuid")
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the channel does not exist", async () => {
    mockSession();
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/moderation-report-list?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 when requesting another channel's moderation queue", async () => {
    mockSession({ userId: "different-user-id" });
    sqlMock.mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] });

    const res = await GET(
      makeRequest(`/api/routes-f/moderation-report-list?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(403);
  });

  it("returns open reports sorted newest first for the channel owner", async () => {
    mockSession();
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "rpt-2",
            target_type: "user",
            target_id: "user-bad-1",
            reporter_id: "viewer-1",
            reason: "Spam",
            status: "open",
            created_at: "2026-08-25T00:00:00.000Z",
          },
          {
            id: "rpt-1",
            target_type: "stream",
            target_id: "stream-1",
            reporter_id: "viewer-2",
            reason: "Misleading title",
            status: "open",
            created_at: "2026-08-24T00:00:00.000Z",
          },
        ],
      });

    const res = await GET(
      makeRequest(`/api/routes-f/moderation-report-list?channel=${CHANNEL_ID}`)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reports).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.reports[0].id).toBe("rpt-2");
  });

  it("passes the status filter and scopes the query to the channel", async () => {
    mockSession();
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/moderation-report-list?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    mockSession();
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(
      makeRequest(`/api/routes-f/moderation-report-list?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(500);
  });
});
