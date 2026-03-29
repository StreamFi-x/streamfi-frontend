/**
 * Tests for DELETE /api/routes-f/vod/chapters/[id]
 *
 * Mocks:
 *   - @vercel/postgres  — no real DB
 *   - next/server       — minimal polyfill
 *   - @/lib/rate-limit  — always allows
 *   - @/lib/auth/verify-session — controllable session
 */

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

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => false,
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { DELETE } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_CHAPTER_ID = "550e8400-e29b-41d4-a716-446655440000";

const authedSession = {
  ok: true as const,
  userId: "user-123",
  wallet: null,
  privyId: "did:privy:abc",
  username: "testuser",
  email: "test@example.com",
};

const unauthSession = {
  ok: false as const,
  response: new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
  }),
};

function makeDeleteRequest(id: string): import("next/server").NextRequest {
  return new Request(`http://localhost/api/routes-f/vod/chapters/${id}`, {
    method: "DELETE",
  }) as unknown as import("next/server").NextRequest;
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

let consoleErrorSpy: jest.SpyInstance;

// ── DELETE tests ───────────────────────────────────────────────────────────────

describe("DELETE /api/routes-f/vod/chapters/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(authedSession);
  });
  afterEach(() => consoleErrorSpy?.mockRestore());

  it("returns 401 when not authenticated", async () => {
    verifySessionMock.mockResolvedValue(unauthSession);
    const res = await DELETE(
      makeDeleteRequest(VALID_CHAPTER_ID),
      makeParams(VALID_CHAPTER_ID)
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-UUID chapter id", async () => {
    const res = await DELETE(makeDeleteRequest("bad-id"), makeParams("bad-id"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 404 when chapter does not exist", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await DELETE(
      makeDeleteRequest(VALID_CHAPTER_ID),
      makeParams(VALID_CHAPTER_ID)
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 403 when caller does not own the recording", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_CHAPTER_ID, user_id: "other-user" }],
    });

    const res = await DELETE(
      makeDeleteRequest(VALID_CHAPTER_ID),
      makeParams(VALID_CHAPTER_ID)
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns 204 on successful deletion", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_CHAPTER_ID, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE

    const res = await DELETE(
      makeDeleteRequest(VALID_CHAPTER_ID),
      makeParams(VALID_CHAPTER_ID)
    );
    expect(res.status).toBe(204);
    // 204 No Content — body is null or undefined depending on runtime
    expect(res.body ?? null).toBeNull();
  });

  it("performs the DELETE query with the correct chapter id", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_CHAPTER_ID, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [] });

    await DELETE(
      makeDeleteRequest(VALID_CHAPTER_ID),
      makeParams(VALID_CHAPTER_ID)
    );

    // SQL calls: 0=SELECT (JOIN), 1=DELETE
    // The DELETE call should include the chapter id as an interpolated value
    const deleteCall = sqlMock.mock.calls[1];
    expect(deleteCall.slice(1)).toContain(VALID_CHAPTER_ID);
  });

  it("returns 500 on unexpected DB error", async () => {
    sqlMock.mockRejectedValueOnce(new Error("DB crash"));

    const res = await DELETE(
      makeDeleteRequest(VALID_CHAPTER_ID),
      makeParams(VALID_CHAPTER_ID)
    );
    expect(res.status).toBe(500);
  });
});
