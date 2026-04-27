/**
 * @jest-environment node
 */
import { POST } from "../percentile/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/percentile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/percentile", () => {
  it("computes p50 (median) from known dataset", async () => {
    const res = await POST(makeReq({ data: [1, 2, 3, 4, 5], percentiles: [50] }));
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results[0].percentile).toBe(50);
    expect(results[0].value).toBe(3);
  });

  it("computes p0 and p100 (min and max)", async () => {
    const res = await POST(makeReq({ data: [10, 20, 30, 40, 50], percentiles: [0, 100] }));
    const { results } = await res.json();
    expect(results[0].value).toBe(10);
    expect(results[1].value).toBe(50);
  });

  it("uses linear interpolation for p25 and p75", async () => {
    const res = await POST(makeReq({ data: [1, 2, 3, 4], percentiles: [25, 75] }));
    const { results } = await res.json();
    expect(results[0].value).toBeCloseTo(1.75, 5);
    expect(results[1].value).toBeCloseTo(3.25, 5);
  });

  it("returns multiple percentiles in input order", async () => {
    const res = await POST(makeReq({ data: [1, 2, 3], percentiles: [90, 10, 50] }));
    const { results } = await res.json();
    expect(results.map((r: { percentile: number }) => r.percentile)).toEqual([90, 10, 50]);
  });

  it("rejects empty data", async () => {
    const res = await POST(makeReq({ data: [], percentiles: [50] }));
    expect(res.status).toBe(400);
  });

  it("rejects empty percentiles array", async () => {
    const res = await POST(makeReq({ data: [1, 2, 3], percentiles: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects percentile out of range", async () => {
    const res = await POST(makeReq({ data: [1, 2, 3], percentiles: [101] }));
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric data values", async () => {
    const res = await POST(makeReq({ data: [1, "two", 3], percentiles: [50] }));
    expect(res.status).toBe(400);
  });
});
