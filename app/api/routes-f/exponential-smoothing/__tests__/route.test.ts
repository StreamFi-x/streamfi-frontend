/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import { exponentialSmooth } from "../smoothing";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/exponential-smoothing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/exponential-smoothing", () => {
  it("follows the exponential smoothing recurrence", async () => {
    const data = [10, 12, 13, 15];
    const alpha = 0.3;
    const res = await POST(makeReq({ data, alpha, forecast: 2 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.smoothed[0]).toBe(data[0]);

    for (let i = 1; i < data.length; i += 1) {
      expect(body.smoothed[i]).toBeCloseTo(
        alpha * data[i] + (1 - alpha) * body.smoothed[i - 1],
        10
      );
    }

    expect(body.forecast).toEqual([body.smoothed.at(-1), body.smoothed.at(-1)]);
  });

  it("defaults alpha to 0.3 and forecast to 1", async () => {
    const res = await POST(makeReq({ data: [1, 2, 3] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.forecast).toHaveLength(1);
    expect(body.smoothed[1]).toBeCloseTo(0.3 * 2 + 0.7 * 1, 10);
  });

  it("rejects alpha outside (0, 1)", async () => {
    const invalid = await POST(makeReq({ data: [1, 2], alpha: 1 }));
    const zero = await POST(makeReq({ data: [1, 2], alpha: 0 }));

    expect(invalid.status).toBe(400);
    expect(zero.status).toBe(400);
  });

  it("rejects empty data", async () => {
    const res = await POST(makeReq({ data: [] }));
    expect(res.status).toBe(400);
  });
});

describe("exponentialSmooth", () => {
  it("returns an empty smoothed array for empty input", () => {
    expect(exponentialSmooth([], 0.5, 2)).toEqual({ smoothed: [], forecast: [0, 0] });
  });
});
