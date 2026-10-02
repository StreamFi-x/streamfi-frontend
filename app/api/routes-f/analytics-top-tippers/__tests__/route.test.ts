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

describe("routes-f analytics-top-tippers", () => {
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
      makeRequest(`/api/routes-f/analytics-top-tippers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when channel is missing or not a UUID", async () => {
    mockSession();

    const res = await GET(
      makeRequest("/api/routes-f/analytics-top-tippers?channel=not-a-uuid")
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is out of range", async () => {
    mockSession();

    const res = await GET(
      makeRequest(
        `/api/routes-f/analytics-top-tippers?channel=${CHANNEL_ID}&limit=500`
      )
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the channel does not exist", async () => {
    mockSession();
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-top-tippers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 when requesting another channel's top tippers", async () => {
    mockSession({ userId: "different-user-id" });
    sqlMock.mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-top-tippers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(403);
  });

  it("returns top tippers ranked by total amount for the channel owner", async () => {
    mockSession();
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({
        rows: [
          {
            supporter_id: "user-1",
            username: "alice",
            total_amount_xlm: "500.5000000",
            tip_count: 4,
          },
          {
            supporter_id: "user-2",
            username: "bob",
            total_amount_xlm: "120.0000000",
            tip_count: 1,
          },
        ],
      });

    const res = await GET(
      makeRequest(
        `/api/routes-f/analytics-top-tippers?channel=${CHANNEL_ID}&days=7&limit=5`
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.top_tippers).toHaveLength(2);
    expect(body.top_tippers[0]).toMatchObject({
      rank: 1,
      username: "alice",
      anonymous: false,
    });
    expect(body.top_tippers[1].rank).toBe(2);
  });

  it("labels a tip from a deleted/anonymous account without dropping it", async () => {
    mockSession();
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({
        rows: [
          {
            supporter_id: null,
            username: null,
            total_amount_xlm: "50.0000000",
            tip_count: 2,
          },
        ],
      });

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-top-tippers?channel=${CHANNEL_ID}`)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.top_tippers[0]).toMatchObject({
      supporter_id: null,
      username: null,
      anonymous: true,
    });
  });

  it("returns 500 when the database throws", async () => {
    mockSession();
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(
      makeRequest(`/api/routes-f/analytics-top-tippers?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(500);
  });
});
