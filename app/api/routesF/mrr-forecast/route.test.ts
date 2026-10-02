import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/mrr-forecast");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("MRR Forecast", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown creator_id", async () => {
    const res = await GET(makeReq({ creator_id: "does-not-exist" }));
    expect(res.status).toBe(404);
  });

  it("returns the current MRR and a 3-month forecast", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.current_mrr_usdc).toBe(1300);
    expect(data.forecast).toHaveLength(3);
  });

  it("projects an upward trend for a growing creator", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1" }));
    const data = await res.json();

    const projections = data.forecast.map((f: { projected_mrr_usdc: number }) => f.projected_mrr_usdc);
    expect(projections[0]).toBeGreaterThan(data.current_mrr_usdc);
    expect(projections[1]).toBeGreaterThan(projections[0]);
    expect(projections[2]).toBeGreaterThan(projections[1]);
  });

  it("projects a downward trend for a declining creator", async () => {
    const res = await GET(makeReq({ creator_id: "creator-2" }));
    const data = await res.json();

    const projections = data.forecast.map((f: { projected_mrr_usdc: number }) => f.projected_mrr_usdc);
    expect(projections[0]).toBeLessThan(data.current_mrr_usdc);
  });

  it("returns forecast months in sequential order", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1" }));
    const data = await res.json();
    expect(data.forecast.map((f: { month: string }) => f.month)).toEqual([
      "2024-07",
      "2024-08",
      "2024-09",
    ]);
  });

  it("never projects a negative MRR", async () => {
    const res = await GET(makeReq({ creator_id: "creator-2" }));
    const data = await res.json();
    for (const point of data.forecast) {
      expect(point.projected_mrr_usdc).toBeGreaterThanOrEqual(0);
    }
  });
});
