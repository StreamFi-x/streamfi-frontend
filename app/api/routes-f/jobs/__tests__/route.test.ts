/**
 * Tests for GET /api/routes-f/jobs and POST /api/routes-f/jobs
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

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureJobsSchema: jest.fn().mockResolvedValue(undefined),
  JOB_TYPES: new Set([
    "export",
    "clip_process",
    "batch_notify",
    "leaderboard_refresh",
    "sitemap_refresh",
  ]),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const AUTHED_SESSION = {
  ok: true as const,
  userId: "user-id",
  wallet: null,
  privyId: "did:privy:abc",
  username: "alice",
  email: "alice@example.com",
};

function makeGetRequest(search = "") {
  return new Request(`http://localhost/api/routes-f/jobs${search}`, {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;
}

function makePostRequest(body: object) {
  return new Request("http://localhost/api/routes-f/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("GET /api/routes-f/jobs", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  afterEach(() => consoleSpy.mockRestore());

  it("returns 401 when not authenticated", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns a list of jobs for the current user", async () => {
    const mockJobs = [
      {
        id: "job-1",
        type: "export",
        status: "completed",
        created_at: "2026-03-27T00:00:00Z",
      },
    ];
    sqlMock.mockResolvedValue({ rows: mockJobs });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.jobs).toHaveLength(1);
    expect(json.jobs[0].id).toBe("job-1");
  });

  it("returns 400 for invalid limit query param", async () => {
    const res = await GET(makeGetRequest("?limit=999"));
    expect(res.status).toBe(400);
  });

  it("returns next_cursor when more jobs exist", async () => {
    const mockJobs = Array.from({ length: 20 }, (_, i) => ({
      id: `job-${i}`,
      type: "export",
      status: "pending",
      created_at: new Date().toISOString(),
    }));
    sqlMock.mockResolvedValue({ rows: mockJobs });

    const res = await GET(makeGetRequest("?limit=20"));
    const json = await res.json();
    expect(json.next_cursor).toBe("job-19");
  });

  it("returns next_cursor: null when fewer jobs than limit", async () => {
    sqlMock.mockResolvedValue({
      rows: [{ id: "job-1", type: "export", status: "done" }],
    });

    const res = await GET(makeGetRequest("?limit=20"));
    const json = await res.json();
    expect(json.next_cursor).toBeNull();
  });
});

describe("POST /api/routes-f/jobs", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  afterEach(() => consoleSpy.mockRestore());

  it("returns 401 when not authenticated", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const res = await POST(makePostRequest({ type: "export" }));
    expect(res.status).toBe(401);
  });

  it("enqueues a job and returns 201 with job id", async () => {
    sqlMock.mockResolvedValue({
      rows: [
        {
          id: "job-new",
          type: "export",
          status: "pending",
          created_at: "2026-03-27T00:00:00Z",
        },
      ],
    });

    const res = await POST(makePostRequest({ type: "export" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("job-new");
    expect(json.status).toBe("pending");
  });

  it("returns 400 for an unknown job type", async () => {
    const res = await POST(makePostRequest({ type: "unknown_type" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing type", async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it("accepts optional payload and max_attempts", async () => {
    sqlMock.mockResolvedValue({
      rows: [
        {
          id: "job-2",
          type: "batch_notify",
          status: "pending",
          created_at: "2026-03-27T00:00:00Z",
        },
      ],
    });

    const res = await POST(
      makePostRequest({
        type: "batch_notify",
        payload: { event_type: "live" },
        max_attempts: 5,
      })
    );
    expect(res.status).toBe(201);
  });

  it("returns 500 on database error", async () => {
    sqlMock.mockRejectedValue(new Error("DB down"));
    const res = await POST(makePostRequest({ type: "export" }));
    expect(res.status).toBe(500);
  });
});
