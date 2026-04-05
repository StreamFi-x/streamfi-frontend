jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureLiveQueueSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, PATCH } from "../route";
import { POST as JOIN } from "../join/route";
import { DELETE as LEAVE } from "../leave/route";
import { POST as NEXT } from "../next/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const SESSION = {
  ok: true as const,
  userId: "creator-id",
  wallet: null,
  privyId: "did:privy:abc",
  username: "creator",
  email: "creator@example.com",
};

const VIEWER_SESSION = {
  ok: true as const,
  userId: "viewer-id",
  wallet: null,
  privyId: "did:privy:def",
  username: "viewer",
  email: "viewer@example.com",
};

const STREAM_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f live queue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(SESSION);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns queue summary for the current viewer", async () => {
    verifySessionMock.mockResolvedValueOnce(VIEWER_SESSION);
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ id: STREAM_ID, user_id: "creator-id" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_open: true }] })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
      .mockResolvedValueOnce({ rows: [{ position: 2 }] });

    const res = await GET(
      makeRequest("GET", `/api/routes-f/live/queue?stream_id=${STREAM_ID}`)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total).toBe(3);
    expect(json.position).toBe(2);
  });

  it("lets a viewer join the queue and returns FIFO position", async () => {
    verifySessionMock.mockResolvedValueOnce(VIEWER_SESSION);
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ id: STREAM_ID, user_id: "creator-id" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_open: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ position: 2, total: 2 }] });

    const res = await JOIN(
      makeRequest("POST", "/api/routes-f/live/queue/join", {
        stream_id: STREAM_ID,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.position).toBe(2);
    expect(json.total).toBe(2);
  });

  it("allows the creator to close the queue", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ id: STREAM_ID, user_id: "creator-id" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_open: false }] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/live/queue", {
        stream_id: STREAM_ID,
        open: false,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.open).toBe(false);
  });

  it("advances the queue in FIFO order", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ user_id: "creator-id" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "entry-id",
            viewer_id: "viewer-id",
            username: "viewer",
            advanced_at: "2026-03-30T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await NEXT(
      makeRequest("POST", "/api/routes-f/live/queue/next", {
        stream_id: STREAM_ID,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.advanced.viewer_id).toBe("viewer-id");
    expect(json.remaining_total).toBe(1);
  });

  it("lets a viewer leave the queue", async () => {
    verifySessionMock.mockResolvedValueOnce(VIEWER_SESSION);
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "entry-id" }] });

    const res = await LEAVE(
      makeRequest("DELETE", "/api/routes-f/live/queue/leave", {
        stream_id: STREAM_ID,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });
});
