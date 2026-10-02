jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST } from "../route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/routes-f/percentile-rank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f percentile-rank", () => {
  const sample = [10, 20, 30, 40, 50];

  it("computes percentile rank for the minimum value", async () => {
    const res = await POST(makeRequest({ data: sample, value: 10 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      percentile_rank: 10,
      count_below: 0,
      count_equal: 1,
    });
  });

  it("computes percentile rank for the median value", async () => {
    const res = await POST(makeRequest({ data: sample, value: 30 }));
    const json = await res.json();

    expect(json).toEqual({
      percentile_rank: 50,
      count_below: 2,
      count_equal: 1,
    });
  });

  it("computes percentile rank for the maximum value", async () => {
    const res = await POST(makeRequest({ data: sample, value: 50 }));
    const json = await res.json();

    expect(json).toEqual({
      percentile_rank: 90,
      count_below: 4,
      count_equal: 1,
    });
  });

  it("handles out-of-range values", async () => {
    const belowRes = await POST(makeRequest({ data: sample, value: 1 }));
    const aboveRes = await POST(makeRequest({ data: sample, value: 99 }));
    const below = await belowRes.json();
    const above = await aboveRes.json();

    expect(below.percentile_rank).toBe(0);
    expect(above.percentile_rank).toBe(100);
  });
});
