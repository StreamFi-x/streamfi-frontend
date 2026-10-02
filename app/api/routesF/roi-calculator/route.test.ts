import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/roi-calculator", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ROI Calculator API", () => {
  it("computes a simple gain", async () => {
    const res = await POST(makeReq({ initial: 100, final: 150 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.roi_percent).toBeCloseTo(50);
    expect(data.gain).toBe(50);
  });

  it("computes a loss", async () => {
    const res = await POST(makeReq({ initial: 200, final: 100 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.roi_percent).toBeCloseTo(-50);
    expect(data.gain).toBe(-100);
  });

  it("computes annualized ROI when years provided", async () => {
    const res = await POST(makeReq({ initial: 100, final: 200, years: 3 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.roi_percent).toBeCloseTo(100);
    expect(data.annualized_percent).toBeCloseTo(25.992, 1);
  });

  it("returns 400 for missing initial", async () => {
    const res = await POST(makeReq({ final: 100 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero initial", async () => {
    const res = await POST(makeReq({ initial: 0, final: 100 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-positive years", async () => {
    const res = await POST(makeReq({ initial: 100, final: 200, years: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/roi-calculator", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
