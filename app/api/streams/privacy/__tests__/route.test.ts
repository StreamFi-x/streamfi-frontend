/**
 * Stream Privacy API route tests.
 */

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

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";

const makeRequest = (method: string, body?: object, search?: string) =>
  new Request(`http://localhost/api/streams/privacy${search ?? ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as unknown as jest.Mock;

describe("GET /api/streams/privacy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 if session is invalid", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 if requested wallet does not match session wallet", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      wallet: "0xALICE",
    });

    const req = makeRequest("GET", undefined, "?wallet=0xBOB");
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns 404 if user not found", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      wallet: "0xALICE",
    });
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const req = makeRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns privacy settings for authenticated user", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      wallet: "0xALICE",
    });
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: "user-1", stream_privacy: "unlisted", share_token: "tok_123" }],
    });

    const req = makeRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.privacy).toBe("unlisted");
    expect(body.shareToken).toBe("tok_123");
  });
});

describe("POST /api/streams/privacy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 if session is invalid", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest("POST", { privacy: "unlisted" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 if body wallet does not match session wallet", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      wallet: "0xALICE",
    });

    const req = makeRequest("POST", { wallet: "0xBOB", privacy: "unlisted" });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns 400 for invalid privacy value", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      wallet: "0xALICE",
    });

    const req = makeRequest("POST", { privacy: "invalid_mode" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("updates privacy and generates share token when transitioning to unlisted", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      wallet: "0xALICE",
    });
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ id: "user-1", stream_privacy: "public", share_token: null }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = makeRequest("POST", { privacy: "unlisted" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.privacy).toBe("unlisted");
    expect(body.shareToken).toBeDefined();
    expect(body.shareToken.length).toBeGreaterThan(0);
  });

  it("rotates token when rotate_token is true", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      wallet: "0xALICE",
    });
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ id: "user-1", stream_privacy: "unlisted", share_token: "old_tok" }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = makeRequest("POST", { rotate_token: true });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shareToken).toBeDefined();
    expect(body.shareToken).not.toBe("old_tok");
  });
});
