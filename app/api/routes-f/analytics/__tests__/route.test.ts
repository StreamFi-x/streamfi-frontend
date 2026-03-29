jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureAnalyticsSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const STREAM_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f analytics", () => {
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

    const res = await GET(makeRequest("GET", "/api/routes-f/analytics"));

    expect(res.status).toBe(401);
  });

  it("returns aggregated watch analytics", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "viewer-id",
      wallet: null,
      privyId: "did:privy:abc",
      username: "viewer",
      email: "viewer@example.com",
    });

    sqlMock
      .mockResolvedValueOnce({
        rows: [{ total_watch_time: 3600, sessions_count: 4 }],
      })
      .mockResolvedValueOnce({
        rows: [{ category: "Tech", watch_time: 1800, sessions: 2 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            stream_id: STREAM_ID,
            username: "alice",
            avatar: null,
            watch_time: 1800,
            sessions: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ bucket: "2026-03-28", watch_time: 1200, sessions: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ bucket: "2026-03-24", watch_time: 2400, sessions: 3 }],
      })
      .mockResolvedValueOnce({
        rows: [{ bucket: "2026-03", watch_time: 3600, sessions: 4 }],
      });

    const res = await GET(makeRequest("GET", "/api/routes-f/analytics"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total_watch_time).toBe(3600);
    expect(json.top_streams).toHaveLength(1);
  });

  it("records a watch event", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "viewer-id",
      wallet: null,
      privyId: "did:privy:abc",
      username: "viewer",
      email: "viewer@example.com",
    });

    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: STREAM_ID }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "event-id",
            user_id: "viewer-id",
            stream_id: STREAM_ID,
            duration_seconds: 120,
            category: "Tech",
            watched_at: "2026-03-28T00:00:00Z",
          },
        ],
      });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/analytics", {
        stream_id: STREAM_ID,
        duration_seconds: 120,
        category: "Tech",
      })
    );

    expect(res.status).toBe(201);
  });
});
