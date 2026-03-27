/**
 * Tests for POST /api/routes-f/import and GET /api/routes-f/import
 *
 * Mocks:
 *   - @vercel/postgres  — no real DB
 *   - next/server       — jsdom polyfill
 *   - @/lib/rate-limit  — always allows
 *   - @/lib/auth/verify-session — controllable session
 *   - global fetch      — intercepts external HTTP calls
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
  createRateLimiter: () => async () => false, // never rate-limited in tests
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { POST, GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeRequest = (
  method: string,
  body?: object,
  search?: string
): import("next/server").NextRequest =>
  new Request(`http://localhost/api/routes-f/import${search ?? ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

const authedSession = {
  ok: true as const,
  userId: "user-123",
  wallet: null,
  privyId: "did:privy:abc",
  username: "testuser",
  email: "test@example.com",
};

// Mock CREATE TABLE IF NOT EXISTS + any subsequent query
function mockEnsureTable() {
  sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ensureJobsTable
}

let consoleErrorSpy: jest.SpyInstance;

// ── POST tests ─────────────────────────────────────────────────────────────────

describe("POST /api/routes-f/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(authedSession);
  });
  afterEach(() => consoleErrorSpy?.mockRestore());

  it("returns 401 when session is invalid", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const req = makeRequest("POST", { source: "json", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid source", async () => {
    const req = makeRequest("POST", {
      source: "instagram",
      data: { foo: "bar" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source/i);
  });

  it("returns 400 when data is missing", async () => {
    const req = makeRequest("POST", { source: "json" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when data is an array", async () => {
    const req = makeRequest("POST", { source: "json", data: [1, 2] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 when user already imported in past 24h", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-old" }] }); // rate-limit check
    const req = makeRequest("POST", {
      source: "json",
      data: { bio: "Hello" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/24 hours/i);
  });

  it("returns 500 when DB fails on rate-limit check", async () => {
    mockEnsureTable();
    sqlMock.mockRejectedValueOnce(new Error("DB down"));
    const req = makeRequest("POST", {
      source: "json",
      data: { bio: "Hello" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 500 when job record creation fails", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // rate-limit check — no recent jobs
    sqlMock.mockRejectedValueOnce(new Error("INSERT failed"));
    const req = makeRequest("POST", {
      source: "json",
      data: { bio: "Hello" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  // ── JSON source ──────────────────────────────────────────────────────────────

  describe("json source", () => {
    it("returns 422 when JSON export is empty", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] }); // rate-limit
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-1" }] }); // INSERT job

      const req = makeRequest("POST", { source: "json", data: {} });
      const res = await POST(req);
      expect(res.status).toBe(422);
      // Call 3 is UPDATE import_jobs SET status = 'failed', error = ${msg}, ... WHERE id = ${jobId}
      // 'failed' is a SQL literal in the template string, not an interpolated value.
      // Interpolated values are: [errorMessage, jobId]
      const failCall = sqlMock.mock.calls[3];
      expect(failCall[1]).toMatch(/must contain/i); // error message
      expect(failCall[2]).toBe("job-1"); // jobId
    });

    it("returns 422 when social_links entries are malformed", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-2" }] });

      const req = makeRequest("POST", {
        source: "json",
        data: { social_links: [{ href: "bad" }] },
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
    });

    it("returns 200 and applies bio import", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] }); // rate-limit
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-3" }] }); // INSERT job
      sqlMock.mockResolvedValueOnce({
        // applyImport SELECT
        rows: [{ bio: null, avatar: null, sociallinks: null, creator: null }],
      });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE users
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job → done

      const req = makeRequest("POST", {
        source: "json",
        data: { bio: "Imported bio" },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.job_id).toBe("job-3");
      expect(body.status).toBe("done");
    });

    it("does not overwrite non-empty bio when overwrite_existing is false", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-4" }] });
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            bio: "Existing bio",
            avatar: null,
            sociallinks: null,
            creator: null,
          },
        ],
      });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE users
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job

      const req = makeRequest("POST", {
        source: "json",
        data: { bio: "New bio" },
        options: { overwrite_existing: false },
      });
      await POST(req);

      // SQL calls: 0=ensureTable, 1=rate-limit, 2=INSERT job, 3=SELECT user, 4=UPDATE users
      const updateUsersCall = sqlMock.mock.calls[4];
      const interpolatedValues = updateUsersCall.slice(1);
      expect(interpolatedValues).toContain("Existing bio");
      expect(interpolatedValues).not.toContain("New bio");
    });

    it("overwrites existing bio when overwrite_existing is true", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-5" }] });
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            bio: "Old bio",
            avatar: null,
            sociallinks: null,
            creator: null,
          },
        ],
      });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE users
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job

      const req = makeRequest("POST", {
        source: "json",
        data: { bio: "New bio" },
        options: { overwrite_existing: true },
      });
      await POST(req);

      // SQL calls: 0=ensureTable, 1=rate-limit, 2=INSERT job, 3=SELECT user, 4=UPDATE users
      const updateUsersCall = sqlMock.mock.calls[4];
      const interpolatedValues = updateUsersCall.slice(1);
      expect(interpolatedValues).toContain("New bio");
    });

    it("maps social_links correctly to socialTitle/socialLink shape", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-6" }] });
      sqlMock.mockResolvedValueOnce({
        rows: [{ bio: null, avatar: null, sociallinks: null, creator: null }],
      });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE users
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job

      const req = makeRequest("POST", {
        source: "json",
        data: {
          social_links: [{ title: "Twitter", url: "https://twitter.com/x" }],
        },
      });
      await POST(req);

      // SQL calls: 0=ensureTable, 1=rate-limit, 2=INSERT job, 3=SELECT user, 4=UPDATE users
      const updateUsersCall = sqlMock.mock.calls[4];
      const interpolatedValues = updateUsersCall.slice(1);
      const socialLinksArg = interpolatedValues.find(
        (v: unknown) => typeof v === "string" && v.includes("socialTitle")
      );
      expect(socialLinksArg).toBeDefined();
      const parsed = JSON.parse(socialLinksArg);
      expect(parsed[0]).toEqual({
        socialTitle: "Twitter",
        socialLink: "https://twitter.com/x",
      });
    });

    it("maps first category to creator.category", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-7" }] });
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            bio: null,
            avatar: null,
            sociallinks: null,
            creator: JSON.stringify({ streamTitle: "My Stream" }),
          },
        ],
      });
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [] });

      const req = makeRequest("POST", {
        source: "json",
        data: { categories: ["Gaming", "IRL"] },
      });
      await POST(req);

      // SQL calls: 0=ensureTable, 1=rate-limit, 2=INSERT job, 3=SELECT user, 4=UPDATE users
      const updateUsersCall = sqlMock.mock.calls[4];
      const interpolatedValues = updateUsersCall.slice(1);
      const creatorArg = interpolatedValues.find(
        (v: unknown) => typeof v === "string" && v.includes("category")
      );
      expect(creatorArg).toBeDefined();
      const parsed = JSON.parse(creatorArg);
      expect(parsed.category).toBe("Gaming");
      expect(parsed.streamTitle).toBe("My Stream"); // existing field preserved
    });
  });

  // ── Twitch source ────────────────────────────────────────────────────────────

  describe("twitch source", () => {
    beforeEach(() => {
      process.env.TWITCH_CLIENT_ID = "test-client-id";
    });
    afterEach(() => {
      delete process.env.TWITCH_CLIENT_ID;
    });

    it("returns 400 when access_token is missing", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-t1" }] });

      global.fetch = jest.fn(); // should not be called

      const req = makeRequest("POST", { source: "twitch", data: {} });
      const res = await POST(req);
      expect(res.status).toBe(422);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("returns 422 when Twitch returns 401", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-t2" }] });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job failed

      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

      const req = makeRequest("POST", {
        source: "twitch",
        data: { access_token: "bad-token" },
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toMatch(/invalid or expired/i);
    });

    it("returns 422 when TWITCH_CLIENT_ID is not configured", async () => {
      delete process.env.TWITCH_CLIENT_ID;
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-t3" }] });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job failed

      const req = makeRequest("POST", {
        source: "twitch",
        data: { access_token: "token" },
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
    });

    it("imports Twitch profile successfully", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-t4" }] });
      sqlMock.mockResolvedValueOnce({
        rows: [{ bio: null, avatar: null, sociallinks: null, creator: null }],
      });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE users
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              description: "Twitch bio",
              profile_image_url: "https://twitch.tv/avatar.png",
            },
          ],
        }),
      });

      const req = makeRequest("POST", {
        source: "twitch",
        data: { access_token: "valid-token" },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify access token is NOT passed to any SQL call (never persisted)
      const allSqlArgs = sqlMock.mock.calls.flatMap((call: unknown[]) =>
        call.slice(1)
      );
      expect(allSqlArgs).not.toContain("valid-token");
    });
  });

  // ── YouTube source ───────────────────────────────────────────────────────────

  describe("youtube source", () => {
    it("returns 400 when channel_url is missing", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-y1" }] });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job failed

      global.fetch = jest.fn();

      const req = makeRequest("POST", { source: "youtube", data: {} });
      const res = await POST(req);
      expect(res.status).toBe(422);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("returns 422 for a non-YouTube URL (SSRF guard)", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-y2" }] });
      sqlMock.mockResolvedValueOnce({ rows: [] }); // UPDATE job failed

      global.fetch = jest.fn();

      const req = makeRequest("POST", {
        source: "youtube",
        data: { channel_url: "https://evil.internal/steal-data" },
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("imports YouTube channel bio and avatar from og: meta tags", async () => {
      mockEnsureTable();
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "job-y3" }] });
      sqlMock.mockResolvedValueOnce({
        rows: [{ bio: null, avatar: null, sociallinks: null, creator: null }],
      });
      sqlMock.mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce({ rows: [] });

      const mockHtml = `
        <html><head>
          <meta property="og:description" content="My YouTube channel bio" />
          <meta property="og:image" content="https://yt3.ggpht.com/avatar.jpg" />
        </head></html>
      `;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      });

      const req = makeRequest("POST", {
        source: "youtube",
        data: { channel_url: "https://www.youtube.com/@testchannel" },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // SQL calls: 0=ensureTable, 1=rate-limit, 2=INSERT job, 3=SELECT user, 4=UPDATE users
      const updateUsersCall = sqlMock.mock.calls[4];
      const interpolatedValues = updateUsersCall.slice(1);
      expect(interpolatedValues).toContain("My YouTube channel bio");
      expect(interpolatedValues).toContain("https://yt3.ggpht.com/avatar.jpg");
    });
  });
});

// ── GET tests ──────────────────────────────────────────────────────────────────

describe("GET /api/routes-f/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(authedSession);
  });
  afterEach(() => consoleErrorSpy?.mockRestore());

  const validJobId = "550e8400-e29b-41d4-a716-446655440000";

  it("returns 401 when not authenticated", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const req = makeRequest("GET", undefined, `?job_id=${validJobId}`);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when job_id is missing", async () => {
    const req = makeRequest("GET", undefined, "");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/job_id/i);
  });

  it("returns 400 for non-UUID job_id", async () => {
    const req = makeRequest("GET", undefined, "?job_id=not-a-uuid");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 404 when job belongs to a different user", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // no rows — different user

    const req = makeRequest("GET", undefined, `?job_id=${validJobId}`);
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns job details for a completed job", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: validJobId,
          status: "done",
          source: "json",
          result: { imported: { bio: "Hello" } },
          error: null,
          created_at: "2026-03-27T00:00:00Z",
          updated_at: "2026-03-27T00:00:01Z",
        },
      ],
    });

    const req = makeRequest("GET", undefined, `?job_id=${validJobId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.job_id).toBe(validJobId);
    expect(body.status).toBe("done");
    expect(body.source).toBe("json");
    expect(body.result).toEqual({ imported: { bio: "Hello" } });
    expect(body.error).toBeNull();
  });

  it("returns job details for a failed job", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: validJobId,
          status: "failed",
          source: "twitch",
          result: null,
          error: "Twitch access token is invalid or expired",
          created_at: "2026-03-27T00:00:00Z",
          updated_at: "2026-03-27T00:00:01Z",
        },
      ],
    });

    const req = makeRequest("GET", undefined, `?job_id=${validJobId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("failed");
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockEnsureTable();
    sqlMock.mockRejectedValueOnce(new Error("DB crash"));

    const req = makeRequest("GET", undefined, `?job_id=${validJobId}`);
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
