jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(body), { ...init, headers });
    },
  },
}));

import { GET } from "../leaderboard/route";
import { computeLeaderboardFromMap } from "@/lib/routes-f/leaderboard";

const makeRequest = (search = "") => new Request(`http://localhost/api/routes-f/leaderboard${search}`);

describe("GET /api/routes-f/leaderboard", () => {
  it("returns 400 for unsupported metric", async () => {
    const res = await GET(makeRequest("?metric=unknown"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unsupported-metric");
  });

  it("deterministic tie handling and ranking from map helper", () => {
    const metrics = {
      a: 100,
      b: 100,
      c: 90,
      d: 100,
    };

    const result = computeLeaderboardFromMap(metrics, 10);
    // ties between a, b, d -> sorted by id asc
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
    expect(result[2].id).toBe("d");
    expect(result[3].id).toBe("c");
    expect(result[0].rank).toBe(1);
  });
});
