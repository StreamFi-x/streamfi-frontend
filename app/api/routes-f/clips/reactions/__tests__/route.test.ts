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
  ensureClipReactionSchema: jest.fn().mockResolvedValue(undefined),
  REACTION_EMOJIS: ["🔥", "❤️", "😂", "👏", "💜", "😮", "💯", "🎉"],
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST, DELETE } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const CLIP_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f clip reactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-id",
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

  it("returns grouped reactions for a clip", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        { emoji: "🔥", count: 2 },
        { emoji: "🎉", count: 1 },
      ],
    });

    const res = await GET(
      makeRequest("GET", `/api/routes-f/clips/reactions?clip_id=${CLIP_ID}`)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total_count).toBe(3);
    expect(json.breakdown).toHaveLength(2);
  });

  it("rejects unsupported emoji", async () => {
    const res = await POST(
      makeRequest("POST", "/api/routes-f/clips/reactions", {
        clip_id: CLIP_ID,
        emoji: "🙂",
      })
    );

    expect(res.status).toBe(400);
  });

  it("rejects duplicate reactions for the same emoji", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CLIP_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/clips/reactions", {
        clip_id: CLIP_ID,
        emoji: "🔥",
      })
    );

    expect(res.status).toBe(409);
  });

  it("removes a reaction and returns the new summary", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ emoji: "🔥", count: 1 }] });

    const res = await DELETE(
      makeRequest("DELETE", "/api/routes-f/clips/reactions", {
        clip_id: CLIP_ID,
        emoji: "🔥",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total_count).toBe(1);
  });
});
