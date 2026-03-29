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
jest.mock("@/app/api/routes-f/_lib/session", () => ({
  getOptionalSession: jest.fn(),
}));
jest.mock("@/lib/upstash", () => ({
  getUpstashRedis: jest.fn().mockResolvedValue(null),
}));

import { sql } from "@vercel/postgres";
import { getOptionalSession } from "@/app/api/routes-f/_lib/session";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const getOptionalSessionMock = getOptionalSession as jest.Mock;

function makeRequest(path: string) {
  return new Request(
    `http://localhost${path}`
  ) as unknown as import("next/server").NextRequest;
}

describe("routes-f recommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns anonymous trending recommendations", async () => {
    getOptionalSessionMock.mockResolvedValue(null);
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          username: "alice",
          avatar: null,
          current_viewers: 120,
          creator: {
            streamTitle: "Ranked grind",
            category: "Gaming",
            tags: ["fps"],
          },
          viewer_score: 0.12,
          freshness_score: 0,
        },
      ],
    });

    const res = await GET(makeRequest("/api/routes-f/recommendations"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.anonymous).toBe(true);
    expect(json.recommended[0].reason).toBe("Trending live stream");
  });

  it("returns personalized recommendations for authenticated users", async () => {
    getOptionalSessionMock.mockResolvedValue({ userId: "viewer-1" });
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "user-2",
          username: "bob",
          avatar: null,
          current_viewers: 54,
          creator: {
            streamTitle: "Live coding",
            category: "Technology",
            tags: ["code"],
          },
          follow_score: 1,
          tip_score: 0,
          category_score: 0,
          tag_score: 0,
          viewer_score: 0.054,
          freshness_score: 0,
        },
      ],
    });

    const res = await GET(makeRequest("/api/routes-f/recommendations"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.anonymous).toBe(false);
    expect(json.recommended[0].reason).toBe("Creator you follow is live");
  });
});
