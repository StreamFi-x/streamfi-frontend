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
  ensureInvitesSchema: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../invites/_lib/db", () => ({
  ensureInvitesSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { POST } from "../route";
import { GET, DELETE } from "../[code]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const STREAM_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f invites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: STREAM_ID,
      wallet: null,
      privyId: "did:privy:abc",
      username: "alice",
      email: "alice@example.com",
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates an invite code for the creator's stream", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: STREAM_ID,
            username: "alice",
            avatar: null,
            creator: { streamTitle: "Live coding" },
            is_live: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            code: "ABCD1234",
            stream_id: STREAM_ID,
            creator_id: STREAM_ID,
            max_uses: 5,
            use_count: 0,
            expires_at: null,
            created_at: "2026-03-28T00:00:00Z",
          },
        ],
      });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/invites", {
        stream_id: STREAM_ID,
        max_uses: 5,
      })
    );

    expect(res.status).toBe(201);
  });

  it("returns 410 for an expired invite code", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          code: "ABCD1234",
          stream_id: STREAM_ID,
          creator_id: STREAM_ID,
          max_uses: 5,
          use_count: 0,
          expires_at: "2020-01-01T00:00:00.000Z",
          revoked_at: null,
          created_at: "2026-03-28T00:00:00Z",
          username: "alice",
          avatar: null,
          is_live: true,
          creator: { streamTitle: "Live coding" },
        },
      ],
    });

    const res = await GET(
      makeRequest("GET", "/api/routes-f/invites/ABCD1234"),
      {
        params: Promise.resolve({ code: "ABCD1234" }),
      }
    );

    expect(res.status).toBe(410);
  });

  it("revokes an invite code for the creator", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ code: "ABCD1234" }],
    });

    const res = await DELETE(
      makeRequest("DELETE", "/api/routes-f/invites/ABCD1234"),
      { params: Promise.resolve({ code: "ABCD1234" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.revoked).toBe(true);
  });
});
