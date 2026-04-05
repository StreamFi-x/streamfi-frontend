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
import { PATCH, DELETE } from "../[id]/route";

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

const TEAM_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f creator/team", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  it("lists creator team members", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          id: TEAM_ID,
          member_id: "member-id",
          username: "moduser",
          avatar: null,
          role: "moderator",
          status: "invited",
          invited_at: "2026-03-28T00:00:00Z",
          updated_at: "2026-03-28T00:00:00Z",
        },
      ],
    });

    const res = await GET(makeRequest("GET", "/api/routes-f/creator/team"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(1);
    expect(json.team[0].role).toBe("moderator");
  });

  it("enforces max 10 team members", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ team_size: 10 }] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/creator/team", {
        username: "moduser",
        role: "moderator",
      })
    );

    expect(res.status).toBe(409);
  });

  it("requires invited user to exist", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ team_size: 2 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/creator/team", {
        username: "ghostuser",
        role: "editor",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toMatch(/does not exist/i);
  });

  it("invites an existing user as a team member", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ team_size: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: "member-id", username: "moduser", avatar: null }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: TEAM_ID,
            creator_id: "creator-id",
            member_id: "member-id",
            role: "moderator",
            status: "invited",
            invited_at: "2026-03-28T00:00:00Z",
            updated_at: "2026-03-28T00:00:00Z",
          },
        ],
      });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/creator/team", {
        username: "moduser",
        role: "moderator",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.role).toBe("moderator");
    expect(json.member.username).toBe("moduser");
  });

  it("updates a team member role", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          id: TEAM_ID,
          creator_id: "creator-id",
          member_id: "member-id",
          role: "editor",
          status: "invited",
          invited_at: "2026-03-28T00:00:00Z",
          updated_at: "2026-03-28T00:00:00Z",
        },
      ],
    });

    const res = await PATCH(
      makeRequest("PATCH", `/api/routes-f/creator/team/${TEAM_ID}`, {
        role: "editor",
      }),
      { params: { id: TEAM_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.role).toBe("editor");
  });

  it("deletes a team member", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: TEAM_ID }] });

    const res = await DELETE(
      makeRequest("DELETE", `/api/routes-f/creator/team/${TEAM_ID}`),
      { params: { id: TEAM_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });
});
