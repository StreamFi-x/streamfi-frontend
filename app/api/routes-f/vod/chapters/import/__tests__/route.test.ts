/**
 * Tests for POST /api/routes-f/vod/chapters/import
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
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_RECORDING_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_STREAM_ID = "660e8400-e29b-41d4-a716-446655440001";

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

function makePostRequest(body?: object): import("next/server").NextRequest {
  return new Request("http://localhost/api/routes-f/vod/chapters/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

function mockEnsureTables() {
  sqlMock.mockResolvedValueOnce({ rows: [] }); // CREATE vod_chapters
  sqlMock.mockResolvedValueOnce({ rows: [] }); // CREATE stream_chapters
}

let consoleErrorSpy: jest.SpyInstance;

// ── POST tests ─────────────────────────────────────────────────────────────────

describe("POST /api/routes-f/vod/chapters/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(authedSession);
  });
  afterEach(() => consoleErrorSpy?.mockRestore());

  it("returns 401 when not authenticated", async () => {
    verifySessionMock.mockResolvedValue(unauthSession);
    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request(
      "http://localhost/api/routes-f/vod/chapters/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid }",
      }
    ) as unknown as import("next/server").NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 when body is an array", async () => {
    const res = await POST(makePostRequest([1, 2] as unknown as object));
    expect(res.status).toBe(400);
  });

  it("returns 400 when recording_id is missing", async () => {
    const res = await POST(makePostRequest({ stream_id: VALID_STREAM_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/recording_id/i);
  });

  it("returns 400 for invalid recording_id format", async () => {
    const res = await POST(
      makePostRequest({ recording_id: "bad", stream_id: VALID_STREAM_ID })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid recording_id/i);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await POST(
      makePostRequest({ recording_id: VALID_RECORDING_ID })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/stream_id/i);
  });

  it("returns 400 for invalid stream_id format", async () => {
    const res = await POST(
      makePostRequest({ recording_id: VALID_RECORDING_ID, stream_id: "bad" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid stream_id/i);
  });

  it("returns 404 when recording does not exist", async () => {
    mockEnsureTables();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // stream_recordings lookup

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 403 when caller does not own the recording", async () => {
    mockEnsureTables();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, user_id: "other-user" }],
    });

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with imported=0 when stream has no chapters", async () => {
    mockEnsureTables();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [] }); // stream_chapters — empty

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.truncated).toBe(false);
  });

  it("returns 422 when recording is already at the 100-chapter cap", async () => {
    mockEnsureTables();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({
      rows: [
        { title: "Ch1", timestamp_seconds: 0 },
        { title: "Ch2", timestamp_seconds: 60 },
      ],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "100" }] }); // existing chapters count

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/maximum/i);
  });

  it("imports all source chapters when under the cap", async () => {
    mockEnsureTables();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({
      rows: [
        { title: "Intro", timestamp_seconds: 0 },
        { title: "Part 2", timestamp_seconds: 300 },
      ],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "0" }] }); // existing count
    sqlMock.mockResolvedValueOnce({ rows: [] }); // INSERT ch 1
    sqlMock.mockResolvedValueOnce({ rows: [] }); // INSERT ch 2

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.truncated).toBe(false);
    expect(body.message).toMatch(/2 chapters/i);
  });

  it("truncates to available slots and sets truncated=true", async () => {
    mockEnsureTables();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, user_id: "user-123" }],
    });
    // 3 source chapters
    sqlMock.mockResolvedValueOnce({
      rows: [
        { title: "A", timestamp_seconds: 0 },
        { title: "B", timestamp_seconds: 60 },
        { title: "C", timestamp_seconds: 120 },
      ],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "99" }] }); // only 1 slot left
    sqlMock.mockResolvedValueOnce({ rows: [] }); // INSERT ch A only

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.truncated).toBe(true);

    // Only 1 INSERT should have been made
    const insertCalls = sqlMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === "object" &&
        (call[0] as TemplateStringsArray)[0]?.includes(
          "INSERT INTO vod_chapters"
        )
    );
    expect(insertCalls).toHaveLength(1);
  });

  it("uses singular 'chapter' in message when importing exactly 1", async () => {
    mockEnsureTables();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({
      rows: [{ title: "Solo", timestamp_seconds: 0 }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "0" }] });
    sqlMock.mockResolvedValueOnce({ rows: [] }); // INSERT

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    const body = await res.json();
    expect(body.message).toMatch(/1 chapter\b/);
    expect(body.message).not.toMatch(/chapters/);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockEnsureTables();
    sqlMock.mockRejectedValueOnce(new Error("DB crash"));

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        stream_id: VALID_STREAM_ID,
      })
    );
    expect(res.status).toBe(500);
  });
});
