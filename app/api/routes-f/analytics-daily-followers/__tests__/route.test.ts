/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureDailyFollowersDependencies: jest.fn().mockResolvedValue(undefined),
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

describe("routes-f analytics-daily-followers", () => {
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
      makeRequest(`/api/routes-f/analytics-daily-followers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when channel is missing or not a UUID", async () => {
    mockSession();

    const res = await GET(
      makeRequest("/api/routes-f/analytics-daily-followers?channel=not-a-uuid")
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the channel does not exist", async () => {
    mockSession();
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-daily-followers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 when requesting another channel's followers", async () => {
    mockSession({ userId: "different-user-id" });
    sqlMock.mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-daily-followers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(403);
  });

  it("returns daily new followers and unfollowers for the channel owner", async () => {
    mockSession();
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({
        rows: [
          { bucket: "2026-08-24", new_followers: 12, unfollowers: 3, net_change: 9 },
          { bucket: "2026-08-25", new_followers: 5, unfollowers: 5, net_change: 0 },
        ],
      });

    const res = await GET(
      makeRequest(
        `/api/routes-f/analytics-daily-followers?channel=${CHANNEL_ID}&days=7`
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.channel).toBe(CHANNEL_ID);
    expect(body.range_days).toBe(7);
    expect(body.daily_followers).toHaveLength(2);
    expect(body.daily_followers[1].net_change).toBe(0);
  });

  it("returns 500 when the database throws", async () => {
    mockSession();
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-daily-followers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(500);
  });
});
