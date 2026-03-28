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

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";
import { DELETE } from "../[id]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const AUTHED_SESSION = {
  ok: true as const,
  userId: "creator-id",
  wallet: null,
  privyId: "did:privy:abc",
  username: "creator",
  email: "creator@example.com",
};

const STREAM_ID = "550e8400-e29b-41d4-a716-446655440000";
const GOAL_ID = "660e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f stream/goals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  it("returns goals with computed progress and marks completed_at", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: GOAL_ID,
            stream_id: STREAM_ID,
            creator_id: "creator-id",
            type: "tip_amount",
            target: "100",
            title: "100 tip goal",
            completed_at: null,
            stream_started_at: "2026-03-28T00:00:00Z",
            created_at: "2026-03-28T00:00:00Z",
            updated_at: "2026-03-28T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ progress: "120" }] })
      .mockResolvedValueOnce({ rows: [{ progress: 3 }] })
      .mockResolvedValueOnce({ rows: [{ progress: 40 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("GET", `/api/routes-f/stream/goals?stream_id=${STREAM_ID}`)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.goals).toHaveLength(1);
    expect(json.goals[0].progress).toBe(120);
    expect(json.goals[0].is_completed).toBe(true);
  });

  it("enforces max 2 active goals per stream", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ active_count: 2 }] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/stream/goals", {
        stream_id: STREAM_ID,
        type: "new_subs",
        target: 10,
        title: "10 new subs",
      })
    );

    expect(res.status).toBe(409);
  });

  it("creates a stream goal and returns computed progress", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ active_count: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ started_at: "2026-03-28T00:00:00Z", user_id: "creator-id" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: GOAL_ID,
            stream_id: STREAM_ID,
            creator_id: "creator-id",
            type: "new_subs",
            target: "10",
            title: "10 new subs",
            completed_at: null,
            stream_started_at: "2026-03-28T00:00:00Z",
            created_at: "2026-03-28T00:00:00Z",
            updated_at: "2026-03-28T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ progress: "40" }] })
      .mockResolvedValueOnce({ rows: [{ progress: 6 }] })
      .mockResolvedValueOnce({ rows: [{ progress: 100 }] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/stream/goals", {
        stream_id: STREAM_ID,
        type: "new_subs",
        target: 10,
        title: "10 new subs",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.target).toBe(10);
    expect(json.progress).toBe(6);
    expect(json.is_completed).toBe(false);
  });

  it("forbids deleting someone else's goal", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: GOAL_ID, creator_id: "another-creator-id" }],
      });

    const res = await DELETE(
      makeRequest("DELETE", `/api/routes-f/stream/goals/${GOAL_ID}`),
      { params: { id: GOAL_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
  });
});
