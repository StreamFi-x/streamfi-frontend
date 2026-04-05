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

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";

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

function makeRequest(path: string) {
  return new Request(
    `http://localhost${path}`
  ) as unknown as import("next/server").NextRequest;
}

describe("routes-f creator goals history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(SESSION);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns completed and expired goal records", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            stream_id: "660e8400-e29b-41d4-a716-446655440000",
            type: "new_subs",
            target: "10",
            title: "10 new subs",
            completed_at: null,
            stream_started_at: "2026-03-20T00:00:00Z",
            created_at: "2026-03-20T00:00:00Z",
            ended_at: "2026-03-22T00:00:00Z",
            archive_sort_at: "2026-03-22T00:00:00Z",
            peak_viewers: 50,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ achieved_value: 4 }] });

    const res = await GET(
      makeRequest("/api/routes-f/creator/goals/history?type=sub_count")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.records).toHaveLength(1);
    expect(json.records[0].type).toBe("sub_count");
    expect(json.records[0].status).toBe("expired");
    expect(json.records[0].achieved_value).toBe(4);
  });
});
