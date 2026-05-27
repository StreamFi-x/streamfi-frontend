import { sql } from "@vercel/postgres";
import { POST } from "../route";
import { verifySession } from "@/lib/auth/verify-session";

// Polyfill NextResponse.json for jsdom test environment
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

const makeRequest = (body: object) =>
  new Request("http://localhost/api/routes-f/history/live/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;

describe("History Track API route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await POST(makeRequest({}), { params: Promise.resolve({ streamId: "live" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-123",
    });

    const res = await POST(makeRequest({ stream_type: "live" }), { params: Promise.resolve({ streamId: "live" }) });
    expect(res.status).toBe(400);
  });

  it("successfully tracks a live stream session (new)", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-123",
    });

    // 1. Resolve streamer
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: "streamer-456", current_title: "Playing Valorant" }],
    });
    // 2. Check existing
    sqlMock.mockResolvedValueOnce({ rows: [] });
    // 3. Insert
    sqlMock.mockResolvedValueOnce({ rowCount: 1 });

    const res = await POST(
      makeRequest({
        stream_type: "live",
        streamer_username: "alice",
        seconds_watched: 30,
      }),
      { params: Promise.resolve({ streamId: "live" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    
    // Check if INSERT was called
    expect(sqlMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("INSERT INTO watch_history")]),
      "user-123",
      "streamer-456",
      "live",
      null,
      "Playing Valorant",
      30,
      expect.anything(),
      false
    );
  });

  it("successfully tracks a live stream session (update)", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-123",
    });

    // 1. Resolve streamer
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: "streamer-456", current_title: "Playing Valorant" }],
    });
    // 2. Check existing
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "history-789", watch_seconds: 60 }] });
    // 3. Update
    sqlMock.mockResolvedValueOnce({ rowCount: 1 });

    const res = await POST(
      makeRequest({
        stream_type: "live",
        streamer_username: "alice",
        seconds_watched: 30,
      }),
      { params: Promise.resolve({ streamId: "live" }) }
    );

    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("UPDATE watch_history")]),
      90, // 60 + 30
      expect.anything(),
      "Playing Valorant",
      false,
      "history-789"
    );
  });
});
