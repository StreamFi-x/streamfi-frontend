import { sql } from "@vercel/postgres";
import { GET } from "../route";
import { GET as GETDaily } from "../daily/route";
import { verifySession } from "@/lib/auth/verify-session";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

function authRequest(url: string): Request {
  return new Request(url, {
    headers: { cookie: "session=mock-token" },
  }) as any;
}

function mockAuth(userId = USER_ID) {
  verifySessionMock.mockResolvedValueOnce({ ok: true, userId });
}

describe("GET /api/routes-f/activity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET(authRequest("http://localhost/api/routes-f/activity"));
    expect(res.status).toBe(401);
  });

  it("returns empty state with null next_cursor", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(authRequest("http://localhost/api/routes-f/activity"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [], next_cursor: null });
  });

  it("returns paginated events with actor details", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "evt-1",
          user_id: USER_ID,
          type: "tip_received",
          actor_id: "actor-1",
          metadata: { amount: "10", currency: "XLM" },
          created_at: "2026-03-26T12:00:00.000Z",
          actor_username: "bob",
          actor_avatar: "https://cdn.example/bob.png",
        },
      ],
    });

    const res = await GET(authRequest("http://localhost/api/routes-f/activity?limit=20"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toEqual({
      id: "evt-1",
      type: "tip_received",
      actor: { username: "bob", avatar: "https://cdn.example/bob.png" },
      metadata: { amount: "10", currency: "XLM" },
      created_at: "2026-03-26T12:00:00.000Z",
    });
    expect(body.next_cursor).toBeNull();
  });

  it("returns next_cursor when more pages exist", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "evt-1",
          user_id: USER_ID,
          type: "new_follower",
          actor_id: "a1",
          metadata: {},
          created_at: "2026-03-26T12:00:00.000Z",
          actor_username: "alice",
          actor_avatar: null,
        },
        {
          id: "evt-2",
          user_id: USER_ID,
          type: "new_follower",
          actor_id: "a2",
          metadata: {},
          created_at: "2026-03-26T11:00:00.000Z",
          actor_username: "carol",
          actor_avatar: null,
        },
      ],
    });

    const res = await GET(
      authRequest("http://localhost/api/routes-f/activity?limit=1")
    );
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.next_cursor).toBe("2026-03-26T12:00:00.000Z");
  });

  it("returns 400 for invalid type filter", async () => {
    mockAuth();
    const res = await GET(
      authRequest("http://localhost/api/routes-f/activity?type=invalid")
    );
    expect(res.status).toBe(400);
  });

  it("accepts valid type filters", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      authRequest("http://localhost/api/routes-f/activity?type=tips")
    );
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("ANY")]),
      USER_ID,
      expect.any(Array),
      21
    );
  });
});

describe("GET /api/routes-f/activity/daily", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns aggregated counts for the day", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({
      rows: [
        { type: "tip_received", metadata: { amount: "5", currency: "XLM" } },
        { type: "tip_received", metadata: { amount: "10", currency: "XLM" } },
        { type: "new_follower", metadata: {} },
        {
          type: "stream_ended",
          metadata: { duration_seconds: 3600, peak_viewers: 120 },
        },
      ],
    });

    const res = await GETDaily(
      authRequest("http://localhost/api/routes-f/activity/daily?date=2026-03-26")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: "2026-03-26",
      tips_received: 2,
      followers_gained: 1,
      stream_duration_seconds: 3600,
      peak_viewers: 120,
    });
  });

  it("returns 400 when date is missing", async () => {
    mockAuth();
    const res = await GETDaily(
      authRequest("http://localhost/api/routes-f/activity/daily")
    );
    expect(res.status).toBe(400);
  });
});
