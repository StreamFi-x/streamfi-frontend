/**
 * @jest-environment node
 */
import { POST } from "../stats/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/stats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/stats", () => {
  it("computes correct stats for a known dataset", async () => {
    const res = await POST(makeReq({ data: [2, 4, 4, 4, 5, 5, 7, 9] }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.count).toBe(8);
    expect(d.sum).toBe(40);
    expect(d.mean).toBe(5);
    expect(d.median).toBe(4.5);
    expect(d.min).toBe(2);
    expect(d.max).toBe(9);
    expect(d.range).toBe(7);
    // sample stddev ≈ 2.14 for this dataset
    expect(d.stddev).toBeCloseTo(2.138, 2);
  });

  it("returns mode array", async () => {
    const res = await POST(makeReq({ data: [1, 2, 2, 3, 3, 3] }));
    const d = await res.json();
    expect(d.mode).toEqual([3]);
  });

  it("returns multiple modes for bimodal data", async () => {
    const res = await POST(makeReq({ data: [1, 1, 2, 2, 3] }));
    const d = await res.json();
    expect(d.mode).toEqual([1, 2]);
  });

  it("single element dataset", async () => {
    const res = await POST(makeReq({ data: [42] }));
    const d = await res.json();
    expect(d.mean).toBe(42);
    expect(d.median).toBe(42);
    expect(d.stddev).toBe(0);
    expect(d.range).toBe(0);
  });

  it("computes iqr", async () => {
    const res = await POST(makeReq({ data: [1, 2, 3, 4, 5] }));
    const d = await res.json();
    expect(d.iqr).toBeGreaterThan(0);
    expect(d.q3).toBeGreaterThan(d.q1);
  });

  it("rejects empty array", async () => {
    const res = await POST(makeReq({ data: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects non-array data", async () => {
    const res = await POST(makeReq({ data: "1,2,3" }));
    expect(res.status).toBe(400);
  });

  it("rejects non-finite values", async () => {
    const res = await POST(makeReq({ data: [1, 2, Infinity] }));
    expect(res.status).toBe(400);
  });

  it("rejects missing data field", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });
});
