/**
 * Tests for GET /api/routes-f/jobs/[id] and DELETE /api/routes-f/jobs/[id]
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
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, DELETE } from "../[id]/route";

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

const VALID_JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeGetRequest() {
  return new Request(`http://localhost/api/routes-f/jobs/${VALID_JOB_ID}`, {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;
}

function makeDeleteRequest() {
  return new Request(`http://localhost/api/routes-f/jobs/${VALID_JOB_ID}`, {
    method: "DELETE",
  }) as unknown as import("next/server").NextRequest;
}

const VALID_PARAMS = { params: { id: VALID_JOB_ID } };
const INVALID_PARAMS = { params: { id: "not-a-uuid" } };

describe("GET /api/routes-f/jobs/[id]", () => {
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
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await GET(makeGetRequest(), VALID_PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid job id format", async () => {
    const res = await GET(makeGetRequest(), INVALID_PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 404 when job does not exist", async () => {
    sqlMock.mockResolvedValue({ rows: [] });
    const res = await GET(makeGetRequest(), VALID_PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns job details when found", async () => {
    const mockJob = {
      id: VALID_JOB_ID,
      type: "export",
      status: "completed",
      result: { download_url: "https://r2.example.com/file.csv" },
    };
    sqlMock.mockResolvedValue({ rows: [mockJob] });

    const res = await GET(makeGetRequest(), VALID_PARAMS);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(VALID_JOB_ID);
    expect(json.status).toBe("completed");
  });
});

describe("DELETE /api/routes-f/jobs/[id]", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  afterEach(() => consoleSpy.mockRestore());

  it("returns 400 for an invalid job id format", async () => {
    const res = await DELETE(makeDeleteRequest(), INVALID_PARAMS);
    expect(res.status).toBe(400);
  });

  it("cancels a pending job and returns cancelled status", async () => {
    sqlMock.mockResolvedValue({ rows: [{ id: VALID_JOB_ID, status: "cancelled" }] });

    const res = await DELETE(makeDeleteRequest(), VALID_PARAMS);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("cancelled");
  });

  it("returns 409 when trying to cancel a non-pending job", async () => {
    // UPDATE returns 0 rows (job is not pending)
    sqlMock.mockResolvedValueOnce({ rows: [] });
    // SELECT returns the job with a non-pending status
    sqlMock.mockResolvedValueOnce({ rows: [{ id: VALID_JOB_ID, status: "running" }] });

    const res = await DELETE(makeDeleteRequest(), VALID_PARAMS);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/running/);
  });

  it("returns 404 when job does not exist", async () => {
    // UPDATE returns 0 rows
    sqlMock.mockResolvedValueOnce({ rows: [] });
    // SELECT also returns 0 rows (job not found)
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await DELETE(makeDeleteRequest(), VALID_PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 500 on database error", async () => {
    sqlMock.mockRejectedValue(new Error("DB down"));
    const res = await DELETE(makeDeleteRequest(), VALID_PARAMS);
    expect(res.status).toBe(500);
  });
});
