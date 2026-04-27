jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { GET } from "../route";

function makeRequest(search = ""): Request {
  return new Request(`http://localhost/api/routes-f/leaderboard${search}`);
}

describe("GET /api/routes-f/leaderboard", () => {
  it("returns weekly entries by default with a limit of 10", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.timeframe).toBe("weekly");
    expect(body.entries).toHaveLength(10);
    expect(body.entries[0]).toEqual(
      expect.objectContaining({
        rank: 1,
      })
    );
  });

  it("returns different leaders for each timeframe", async () => {
    const daily = await (await GET(makeRequest("?timeframe=daily"))).json();
    const weekly = await (await GET(makeRequest("?timeframe=weekly"))).json();
    const monthly = await (await GET(makeRequest("?timeframe=monthly"))).json();
    const allTime = await (
      await GET(makeRequest("?timeframe=all-time"))
    ).json();

    const leaders = [
      daily.entries[0].username,
      weekly.entries[0].username,
      monthly.entries[0].username,
      allTime.entries[0].username,
    ];

    expect(new Set(leaders).size).toBe(4);
  });

  it("supports pagination while keeping global ranks intact", async () => {
    const pageOne = await (
      await GET(makeRequest("?timeframe=all-time&limit=5&page=1"))
    ).json();
    const pageTwo = await (
      await GET(makeRequest("?timeframe=all-time&limit=5&page=2"))
    ).json();

    expect(pageOne.entries).toHaveLength(5);
    expect(pageTwo.entries).toHaveLength(5);
    expect(pageOne.entries[0].rank).toBe(1);
    expect(pageTwo.entries[0].rank).toBe(6);
    expect(pageOne.entries[0].username).not.toBe(pageTwo.entries[0].username);
    expect(pageTwo.has_more).toBe(true);
  });

  it("caps the limit at 100", async () => {
    const response = await GET(makeRequest("?limit=200"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.limit).toBe(100);
    expect(body.entries).toHaveLength(50);
  });

  it("returns 400 for an invalid timeframe", async () => {
    const response = await GET(makeRequest("?timeframe=yearly"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/invalid timeframe/i);
  });
});
