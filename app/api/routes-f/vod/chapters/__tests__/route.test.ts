/**
 * Tests for GET /api/routes-f/vod/chapters and POST /api/routes-f/vod/chapters
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
import { GET, POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_RECORDING_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_CHAPTER_ID = "660e8400-e29b-41d4-a716-446655440001";

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

function makeGetRequest(search?: string): import("next/server").NextRequest {
  return new Request(
    `http://localhost/api/routes-f/vod/chapters${search ?? ""}`,
    { method: "GET" }
  ) as unknown as import("next/server").NextRequest;
}

function makePostRequest(body?: object): import("next/server").NextRequest {
  return new Request("http://localhost/api/routes-f/vod/chapters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

function mockEnsureTable() {
  sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

let consoleErrorSpy: jest.SpyInstance;

// ── GET tests ──────────────────────────────────────────────────────────────────

describe("GET /api/routes-f/vod/chapters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(authedSession);
  });
  afterEach(() => consoleErrorSpy?.mockRestore());

  it("returns 400 when recording_id is missing", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/recording_id/i);
  });

  it("returns 400 for a non-UUID recording_id", async () => {
    const res = await GET(makeGetRequest("?recording_id=not-a-uuid"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 404 when recording does not exist", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // stream_recordings lookup

    const res = await GET(
      makeGetRequest(`?recording_id=${VALID_RECORDING_ID}`)
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 with chapters ordered by timestamp", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [{ id: VALID_RECORDING_ID }] }); // recording exists
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: VALID_CHAPTER_ID,
          recording_id: VALID_RECORDING_ID,
          title: "Intro",
          timestamp_seconds: 0,
          created_at: "2026-03-28T00:00:00Z",
        },
        {
          id: "770e8400-e29b-41d4-a716-446655440002",
          recording_id: VALID_RECORDING_ID,
          title: "Part 2",
          timestamp_seconds: 120,
          created_at: "2026-03-28T00:00:01Z",
        },
      ],
    });

    const res = await GET(
      makeGetRequest(`?recording_id=${VALID_RECORDING_ID}`)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters).toHaveLength(2);
    expect(body.chapters[0].title).toBe("Intro");
    expect(body.chapters[1].title).toBe("Part 2");
  });

  it("returns 200 with empty chapters array when none exist", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [{ id: VALID_RECORDING_ID }] });
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeGetRequest(`?recording_id=${VALID_RECORDING_ID}`)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters).toEqual([]);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockEnsureTable();
    sqlMock.mockRejectedValueOnce(new Error("DB crash"));

    const res = await GET(
      makeGetRequest(`?recording_id=${VALID_RECORDING_ID}`)
    );
    expect(res.status).toBe(500);
  });
});

// ── POST tests ─────────────────────────────────────────────────────────────────

describe("POST /api/routes-f/vod/chapters", () => {
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
        title: "Intro",
        timestamp_seconds: 0,
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/routes-f/vod/chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json }",
    }) as unknown as import("next/server").NextRequest;
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
    const res = await POST(
      makePostRequest({ title: "Intro", timestamp_seconds: 10 })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/recording_id/i);
  });

  it("returns 400 for invalid recording_id format", async () => {
    const res = await POST(
      makePostRequest({
        recording_id: "bad-id",
        title: "Intro",
        timestamp_seconds: 10,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid recording_id/i);
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        timestamp_seconds: 10,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it("returns 400 when title is an empty string", async () => {
    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "   ",
        timestamp_seconds: 10,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it("returns 400 when timestamp_seconds is negative", async () => {
    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Intro",
        timestamp_seconds: -1,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/timestamp_seconds/i);
  });

  it("returns 400 when timestamp_seconds is a float", async () => {
    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Intro",
        timestamp_seconds: 10.5,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/timestamp_seconds/i);
  });

  it("returns 400 when timestamp_seconds is a string", async () => {
    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Intro",
        timestamp_seconds: "10",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/timestamp_seconds/i);
  });

  it("returns 404 when recording does not exist", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // stream_recordings lookup

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Intro",
        timestamp_seconds: 0,
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller does not own the recording", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, duration: 600, user_id: "other-user" }],
    });

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Intro",
        timestamp_seconds: 10,
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 422 when timestamp_seconds exceeds recording duration", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, duration: 300, user_id: "user-123" }],
    });

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "End",
        timestamp_seconds: 400,
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/exceeds/i);
  });

  it("returns 422 when recording is already at the 100-chapter cap", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, duration: 3600, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "100" }] }); // chapter count

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Chapter 101",
        timestamp_seconds: 60,
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/maximum/i);
  });

  it("returns 201 with the created chapter on success", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, duration: 3600, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "0" }] }); // chapter count
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: VALID_CHAPTER_ID,
          recording_id: VALID_RECORDING_ID,
          title: "Intro",
          timestamp_seconds: 0,
          created_at: "2026-03-28T00:00:00Z",
        },
      ],
    });

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Intro",
        timestamp_seconds: 0,
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chapter.id).toBe(VALID_CHAPTER_ID);
    expect(body.chapter.title).toBe("Intro");
    expect(body.chapter.timestamp_seconds).toBe(0);
  });

  it("trims whitespace from title before inserting", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, duration: 3600, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "0" }] });
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: VALID_CHAPTER_ID,
          recording_id: VALID_RECORDING_ID,
          title: "Trimmed Title",
          timestamp_seconds: 5,
          created_at: "2026-03-28T00:00:00Z",
        },
      ],
    });

    await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "  Trimmed Title  ",
        timestamp_seconds: 5,
      })
    );

    // The INSERT call receives the trimmed title as an interpolated value
    // SQL calls: 0=ensureTable, 1=SELECT recording, 2=COUNT chapters, 3=INSERT
    const insertCall = sqlMock.mock.calls[3];
    expect(insertCall.slice(1)).toContain("Trimmed Title");
    expect(insertCall.slice(1)).not.toContain("  Trimmed Title  ");
  });

  it("allows timestamp_seconds equal to recording duration", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, duration: 300, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "0" }] });
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: VALID_CHAPTER_ID,
          recording_id: VALID_RECORDING_ID,
          title: "End",
          timestamp_seconds: 300,
          created_at: "2026-03-28T00:00:00Z",
        },
      ],
    });

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "End",
        timestamp_seconds: 300,
      })
    );
    expect(res.status).toBe(201);
  });

  it("skips duration check when recording has no duration", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: VALID_RECORDING_ID, duration: null, user_id: "user-123" }],
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ count: "0" }] });
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: VALID_CHAPTER_ID,
          recording_id: VALID_RECORDING_ID,
          title: "Chapter",
          timestamp_seconds: 9999,
          created_at: "2026-03-28T00:00:00Z",
        },
      ],
    });

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Chapter",
        timestamp_seconds: 9999,
      })
    );
    expect(res.status).toBe(201);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockEnsureTable();
    sqlMock.mockRejectedValueOnce(new Error("DB crash"));

    const res = await POST(
      makePostRequest({
        recording_id: VALID_RECORDING_ID,
        title: "Intro",
        timestamp_seconds: 10,
      })
    );
    expect(res.status).toBe(500);
  });
});
