import { sql } from "@vercel/postgres";
import { GET, DELETE } from "../route";
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

const makeRequest = (method: string, body?: object, search?: string) =>
  new Request(`http://localhost/api/routes-f/history${search ?? ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as any;

describe("History API routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/routes-f/history", () => {
    it("returns 401 when unauthorized", async () => {
      verifySessionMock.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(401);
    });

    it("returns history for authorized user", async () => {
      verifySessionMock.mockResolvedValueOnce({
        ok: true,
        userId: "user-123",
      });

      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            stream_type: "live",
            stream_title: "Live Test",
            watched_at: "2025-01-01T00:00:00Z",
            watch_seconds: 300,
            completed: false,
            streamer_username: "alice",
            streamer_avatar: "avatar.png",
          },
        ],
      });

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.history).toHaveLength(1);
      expect(body.history[0].streamer.username).toBe("alice");
    });
  });

  describe("DELETE /api/routes-f/history", () => {
    it("clears history for authorized user", async () => {
      verifySessionMock.mockResolvedValueOnce({
        ok: true,
        userId: "user-123",
      });

      sqlMock.mockResolvedValueOnce({ rowCount: 1 });

      const res = await DELETE(makeRequest("DELETE"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(sqlMock).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining("DELETE FROM watch_history")]),
        "user-123"
      );
    });
  });
});
