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

jest.mock("@/app/api/routes-f/analytics/_lib/db", () => ({
  ensureAnalyticsSchema: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/api/routes-f/gifts/_lib/db", () => ({
  ensureGiftSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;

function makeRequest(path: string) {
  return new Request(
    `http://localhost${path}`
  ) as unknown as import("next/server").NextRequest;
}

describe("routes-f leaderboard weekly", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns earnings leaderboard entries with cache headers", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          rank: 1,
          username: "alice",
          avatar_url: "/Images/user.png",
          value: "150.00",
        },
      ],
    });

    const res = await GET(
      makeRequest(
        "/api/routes-f/leaderboard/weekly?type=earnings&period=weekly"
      )
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entries[0].username).toBe("alice");
    expect(res.headers.get("Cache-Control")).toContain("max-age=600");
  });
});
