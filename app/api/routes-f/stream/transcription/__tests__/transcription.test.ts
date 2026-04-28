/**
 * Transcription API — unit tests
 *
 * Run with:  npx vitest --run app/api/routes-f/stream/transcription/__tests__
 *
 * Mocks:
 *  - @vercel/postgres  → in-memory job/recording stores
 *  - @/lib/auth/verify-session → controllable session fixture
 *  - @/lib/rate-limit  → always passes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const OWNER_ID = "user-owner-001";
const OTHER_ID = "user-other-002";
const RECORDING_ID = "rec-abc123";
const JOB_ID = "job-xyz789";

const recordings: Record<string, { id: string; user_id: string; status: string }> = {
  [RECORDING_ID]: { id: RECORDING_ID, user_id: OWNER_ID, status: "ready" },
};

const jobs: Record<string, { id: string; recording_id: string; user_id: string; status: string; content: string | null; error_reason: string | null }> = {};

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("@vercel/postgres", () => ({
  sql: new Proxy(
    {},
    {
      get: () =>
        async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const query = strings.join("?").toLowerCase();

          // GET transcription_jobs by recording_id
          if (query.includes("from transcription_jobs") && query.includes("recording_id")) {
            const recId = values[0] as string;
            const job = Object.values(jobs).find((j) => j.recording_id === recId);
            return { rows: job ? [job] : [] };
          }

          // GET transcription_jobs by id (VTT endpoint)
          if (query.includes("from transcription_jobs") && query.includes("where id")) {
            const id = values[0] as string;
            const job = jobs[id];
            return { rows: job ? [job] : [] };
          }

          // GET stream_recordings
          if (query.includes("from stream_recordings")) {
            const id = values[0] as string;
            const rec = recordings[id];
            return { rows: rec ? [rec] : [] };
          }

          // INSERT / UPSERT transcription_jobs
          if (query.includes("insert into transcription_jobs")) {
            const [recId, userId] = values as string[];
            const existing = Object.values(jobs).find((j) => j.recording_id === recId);
            if (existing) {
              existing.updated_at = new Date().toISOString();
              return { rows: [{ id: existing.id, status: existing.status }] };
            }
            const newJob = {
              id: JOB_ID,
              recording_id: recId,
              user_id: userId,
              status: "pending",
              content: null,
              error_reason: null,
            };
            jobs[JOB_ID] = newJob;
            return { rows: [{ id: newJob.id, status: newJob.status }] };
          }

          return { rows: [] };
        },
    }
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => false,
}));

let mockSession: { ok: boolean; userId?: string; response?: Response } = { ok: false };

vi.mock("@/lib/auth/verify-session", () => ({
  verifySession: async () => mockSession,
}));

// ── Import handlers after mocks are set up ────────────────────────────────────
const { GET, POST } = await import("../route");
const { GET: GET_VTT } = await import("../[id]/vtt/route");

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function asOwner() {
  mockSession = { ok: true, userId: OWNER_ID } as typeof mockSession;
}

function asOther() {
  mockSession = { ok: true, userId: OTHER_ID } as typeof mockSession;
}

function asUnauthenticated() {
  mockSession = {
    ok: false,
    response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  } as typeof mockSession;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("GET /api/routes-f/stream/transcription", () => {
  beforeEach(() => {
    // Seed a ready job
    jobs[JOB_ID] = {
      id: JOB_ID,
      recording_id: RECORDING_ID,
      user_id: OWNER_ID,
      status: "ready",
      content: "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello world",
      error_reason: null,
    };
  });

  it("returns 401 for unauthenticated requests", async () => {
    asUnauthenticated();
    const res = await GET(makeReq("GET", `http://localhost/api/routes-f/stream/transcription?recording_id=${RECORDING_ID}`));
    expect(res.status).toBe(401);
  });

  it("returns 400 when recording_id is missing", async () => {
    asOwner();
    const res = await GET(makeReq("GET", "http://localhost/api/routes-f/stream/transcription"));
    expect(res.status).toBe(400);
  });

  it("returns correct status and content when ready", async () => {
    asOwner();
    const res = await GET(makeReq("GET", `http://localhost/api/routes-f/stream/transcription?recording_id=${RECORDING_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.recording_id).toBe(RECORDING_ID);
    expect(body.content).toContain("WEBVTT");
  });

  it("omits content when status is pending", async () => {
    asOwner();
    jobs[JOB_ID].status = "pending";
    jobs[JOB_ID].content = null;
    const res = await GET(makeReq("GET", `http://localhost/api/routes-f/stream/transcription?recording_id=${RECORDING_ID}`));
    const body = await res.json();
    expect(body.status).toBe("pending");
    expect(body.content).toBeUndefined();
  });

  it("returns 403 when a non-owner requests the transcription", async () => {
    asOther();
    const res = await GET(makeReq("GET", `http://localhost/api/routes-f/stream/transcription?recording_id=${RECORDING_ID}`));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/routes-f/stream/transcription", () => {
  beforeEach(() => {
    // Clear jobs so each test starts fresh
    for (const key of Object.keys(jobs)) delete jobs[key];
  });

  it("returns 401 for unauthenticated requests", async () => {
    asUnauthenticated();
    const res = await POST(makeReq("POST", "http://localhost/api/routes-f/stream/transcription", { recording_id: RECORDING_ID }));
    expect(res.status).toBe(401);
  });

  it("triggers job and returns pending status", async () => {
    asOwner();
    const res = await POST(makeReq("POST", "http://localhost/api/routes-f/stream/transcription", { recording_id: RECORDING_ID }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.job_id).toBe(JOB_ID);
    expect(body.status).toBe("pending");
  });

  it("rejects non-owner with 403", async () => {
    asOther();
    const res = await POST(makeReq("POST", "http://localhost/api/routes-f/stream/transcription", { recording_id: RECORDING_ID }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when recording_id is missing", async () => {
    asOwner();
    const res = await POST(makeReq("POST", "http://localhost/api/routes-f/stream/transcription", {}));
    expect(res.status).toBe(400);
  });

  it("returns existing job if one already exists", async () => {
    asOwner();
    // First call creates it
    await POST(makeReq("POST", "http://localhost/api/routes-f/stream/transcription", { recording_id: RECORDING_ID }));
    // Second call should return the same job
    const res = await POST(makeReq("POST", "http://localhost/api/routes-f/stream/transcription", { recording_id: RECORDING_ID }));
    const body = await res.json();
    expect(body.job_id).toBe(JOB_ID);
  });
});

describe("GET /api/routes-f/stream/transcription/[id]/vtt", () => {
  beforeEach(() => {
    jobs[JOB_ID] = {
      id: JOB_ID,
      recording_id: RECORDING_ID,
      user_id: OWNER_ID,
      status: "ready",
      content: "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello world",
      error_reason: null,
    };
  });

  it("returns 401 for unauthenticated requests", async () => {
    asUnauthenticated();
    const res = await GET_VTT(
      makeReq("GET", `http://localhost/api/routes-f/stream/transcription/${JOB_ID}/vtt`),
      { params: { id: JOB_ID } }
    );
    expect(res.status).toBe(401);
  });

  it("streams VTT with correct Content-Type", async () => {
    asOwner();
    const res = await GET_VTT(
      makeReq("GET", `http://localhost/api/routes-f/stream/transcription/${JOB_ID}/vtt`),
      { params: { id: JOB_ID } }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/vtt");
    const text = await res.text();
    expect(text).toContain("WEBVTT");
  });

  it("returns 404 when transcription is not ready", async () => {
    asOwner();
    jobs[JOB_ID].status = "processing";
    jobs[JOB_ID].content = null;
    const res = await GET_VTT(
      makeReq("GET", `http://localhost/api/routes-f/stream/transcription/${JOB_ID}/vtt`),
      { params: { id: JOB_ID } }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when transcription does not exist", async () => {
    asOwner();
    const res = await GET_VTT(
      makeReq("GET", "http://localhost/api/routes-f/stream/transcription/nonexistent/vtt"),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when requester is not the owner", async () => {
    asOther();
    const res = await GET_VTT(
      makeReq("GET", `http://localhost/api/routes-f/stream/transcription/${JOB_ID}/vtt`),
      { params: { id: JOB_ID } }
    );
    expect(res.status).toBe(403);
  });
});
