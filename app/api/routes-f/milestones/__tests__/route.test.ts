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
  ensureMilestonesSchema: jest.fn().mockResolvedValue(undefined),
  MILESTONE_TYPES: ["sub_count", "tip_amount", "viewer_count"],
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const AUTHED_SESSION = {
  ok: true as const,
  userId: "creator-id",
  wallet: null,
  privyId: "did:privy:abc",
  username: "alice",
  email: "alice@example.com",
};

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f milestones", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("lists milestones with live progress and stamps completion", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "creator-id",
            username: "alice",
            total_tips_received: "120",
            current_viewers: 42,
            follower_count: 15,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: VALID_ID,
            creator_id: "creator-id",
            type: "tip_amount",
            target: "100",
            title: "Reach first 100 USDC",
            reward_description: null,
            completed_at: null,
            created_at: "2026-03-27T00:00:00Z",
            updated_at: "2026-03-27T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("GET", "/api/routes-f/milestones?creator=alice")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.metrics.tip_amount).toBe(120);
    expect(json.completed).toHaveLength(1);
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });

  it("rejects creating more than 5 active milestones", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ active_count: 5 }] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/milestones", {
        type: "sub_count",
        target: 20,
        title: "20 followers",
      })
    );

    expect(res.status).toBe(409);
  });

  it("creates a milestone", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ active_count: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: VALID_ID,
            creator_id: "creator-id",
            type: "viewer_count",
            target: "100",
            title: "100 viewers",
            reward_description: "Giveaway",
            completed_at: null,
            created_at: "2026-03-27T00:00:00Z",
            updated_at: "2026-03-27T00:00:00Z",
          },
        ],
      });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/milestones", {
        type: "viewer_count",
        target: 100,
        title: "100 viewers",
        reward_description: "Giveaway",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.target).toBe(100);
  });

  it("updates a milestone", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: VALID_ID,
          creator_id: "creator-id",
          type: "sub_count",
          target: "25",
          title: "25 supporters",
          reward_description: null,
          completed_at: null,
          created_at: "2026-03-27T00:00:00Z",
          updated_at: "2026-03-27T00:00:00Z",
        },
      ],
    });

    const res = await PATCH(
      makeRequest("PATCH", `/api/routes-f/milestones/${VALID_ID}`, {
        target: 25,
        title: "25 supporters",
      }),
      { params: { id: VALID_ID } }
    );

    expect(res.status).toBe(200);
  });

  it("deletes a milestone", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: VALID_ID }] });

    const res = await DELETE(
      makeRequest("DELETE", `/api/routes-f/milestones/${VALID_ID}`),
      { params: { id: VALID_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });
});
