/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/linear-regression", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/linear-regression", () => {
  it("fits a perfect line", async () => {
    const res = await POST(makeReq({ x: [1, 2, 3], y: [2, 4, 6] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slope).toBeCloseTo(2, 6);
    expect(body.intercept).toBeCloseTo(0, 6);
    expect(body.r_squared).toBeCloseTo(1, 6);
    expect(body.equation).toContain("y =");
  });

  it("handles noisy data", async () => {
    const x = [1, 2, 3, 4, 5, 6];
    const y = [2.1, 3.8, 5.9, 8.2, 9.9, 12.3];
    const res = await POST(makeReq({ x, y }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slope).toBeGreaterThan(1.8);
    expect(body.slope).toBeLessThan(2.2);
    expect(body.r_squared).toBeGreaterThan(0.98);
  });

  it("returns predictions when predict_x is supplied", async () => {
    const res = await POST(
      makeReq({
        x: [0, 1, 2, 3],
        y: [1, 3, 5, 7],
        predict_x: [4, 5],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.predictions).toEqual([9, 11]);
  });

  it("rejects mismatched lengths", async () => {
    const res = await POST(makeReq({ x: [1, 2], y: [1] }));
    expect(res.status).toBe(400);
  });

  it("rejects fewer than 2 points", async () => {
    const res = await POST(makeReq({ x: [1], y: [2] }));
    expect(res.status).toBe(400);
  });
});
