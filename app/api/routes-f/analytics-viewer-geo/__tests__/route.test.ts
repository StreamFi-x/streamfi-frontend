/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
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

describe("routes-f analytics-viewer-geo", () => {
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
      makeRequest(`/api/routes-f/analytics-viewer-geo?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when channel is missing or not a UUID", async () => {
    mockSession();

    const res = await GET(
      makeRequest("/api/routes-f/analytics-viewer-geo?channel=not-a-uuid")
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when days is out of range", async () => {
    mockSession();

    const res = await GET(
      makeRequest(
        `/api/routes-f/analytics-viewer-geo?channel=${CHANNEL_ID}&days=9999`
      )
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the channel does not exist", async () => {
    mockSession();
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-viewer-geo?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 when requesting another channel's viewer geo", async () => {
    mockSession({ userId: "different-user-id" });
    sqlMock.mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-viewer-geo?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(403);
  });

  it("returns viewer counts bucketed by country, sorted descending", async () => {
    mockSession();
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({
        rows: [
          { country: "US", viewer_count: 120 },
          { country: "NG", viewer_count: 85 },
          { country: null, viewer_count: 3 },
        ],
      });

    const res = await GET(
      makeRequest(
        `/api/routes-f/analytics-viewer-geo?channel=${CHANNEL_ID}&days=7`
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.by_country).toHaveLength(3);
    expect(body.by_country[0]).toEqual({ country: "US", viewer_count: 120 });
    expect(body.by_country[2]).toEqual({ country: "unknown", viewer_count: 3 });
    expect(body.total_viewers).toBe(208);
  });

  it("returns an empty breakdown and zero total when there are no viewers", async () => {
    mockSession();
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-viewer-geo?channel=${CHANNEL_ID}`)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.by_country).toEqual([]);
    expect(body.total_viewers).toBe(0);
  });

  it("returns 500 when the database throws", async () => {
    mockSession();
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-viewer-geo?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(500);
  });
});
