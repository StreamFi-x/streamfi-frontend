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
jest.mock("@/app/api/routes-f/_lib/session", () => ({
  getOptionalSession: jest.fn(),
}));
jest.mock("../_lib/db", () => ({
  ensurePollSchema: jest.fn().mockResolvedValue(undefined),
  closeExpiredPolls: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { getOptionalSession } from "@/app/api/routes-f/_lib/session";
import { GET, POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const getOptionalSessionMock = getOptionalSession as jest.Mock;

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f polls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "streamer-1",
      wallet: null,
      privyId: "did:privy:streamer",
      username: "streamer",
      email: "streamer@example.com",
    });
    getOptionalSessionMock.mockResolvedValue(null);
  });

  it("returns the active poll for a stream", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: "poll-1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "poll-1",
            question: "Which game next?",
            options: [
              { id: 1, text: "Valorant" },
              { id: 2, text: "Minecraft" },
            ],
            status: "active",
            closes_at: "2026-03-29T12:00:00Z",
            viewer_voted: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { option_id: 1, votes: 4 },
          { option_id: 2, votes: 2 },
        ],
      });

    const res = await GET(
      makeRequest(
        "GET",
        "/api/routes-f/polls?stream_id=550e8400-e29b-41d4-a716-446655440000"
      )
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.options[0].votes).toBe(4);
    expect(json.options[0].percentage).toBe(67);
  });

  it("creates a poll for the stream owner", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ user_id: "streamer-1" }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "poll-1" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "poll-1",
            question: "Which game next?",
            options: [
              { id: 1, text: "Valorant" },
              { id: 2, text: "Minecraft" },
            ],
            status: "active",
            closes_at: "2026-03-29T12:00:00Z",
            viewer_voted: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/polls", {
        stream_id: "550e8400-e29b-41d4-a716-446655440000",
        question: "Which game next?",
        options: ["Valorant", "Minecraft"],
        duration_seconds: 60,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.question).toBe("Which game next?");
  });
});
