import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";

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
const verifySessionMock = verifySession as unknown as jest.Mock;

const makeRequest = (method: string, body?: object, search?: string) =>
  new Request(`http://localhost/api/streams/privacy${search ?? ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("Security Issue #1611: Authenticated stream privacy route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-123",
      wallet: "0xCREATOR_WALLET",
      username: "alice",
    });
  });

  describe("GET /api/streams/privacy", () => {
    it("returns 401 when unauthenticated", async () => {
      verifySessionMock.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      });

      const req = makeRequest("GET");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when requesting another user's wallet privacy", async () => {
      const req = makeRequest("GET", undefined, "?wallet=0xVICTIM_WALLET");
      const res = await GET(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Forbidden");
    });

    it("returns 200 with privacy and share token for authenticated user", async () => {
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "user-123",
            stream_privacy: "subscribers_only",
            share_token: "token_abc123",
            wallet: "0xCREATOR_WALLET",
          },
        ],
      });

      const req = makeRequest("GET", undefined, "?wallet=0xCREATOR_WALLET");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.privacy).toBe("subscribers_only");
      expect(data.shareToken).toBe("token_abc123");
    });
  });

  describe("POST /api/streams/privacy", () => {
    it("returns 401 when unauthenticated", async () => {
      verifySessionMock.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      });

      const req = makeRequest("POST", { privacy: "subscribers_only" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when body wallet does not match session wallet", async () => {
      const req = makeRequest("POST", {
        wallet: "0xVICTIM_WALLET",
        privacy: "unlisted",
        rotate_token: true,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Forbidden");
    });

    it("returns 400 for invalid privacy value", async () => {
      const req = makeRequest("POST", { privacy: "invalid_mode" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid privacy value");
    });

    it("updates privacy and rotates token when requested by authenticated owner", async () => {
      sqlMock
        .mockResolvedValueOnce({
          rows: [
            {
              id: "user-123",
              stream_privacy: "public",
              share_token: "old_token_123",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE users

      const req = makeRequest("POST", {
        privacy: "subscribers_only",
        rotate_token: true,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.privacy).toBe("subscribers_only");
      expect(data.shareToken).toBeDefined();
      expect(data.shareToken).not.toBe("old_token_123");
    });
  });
});
