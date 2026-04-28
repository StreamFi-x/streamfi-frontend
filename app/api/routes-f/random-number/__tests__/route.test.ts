/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/random-number", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mean(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

describe("POST /api/routes-f/random-number", () => {
  it("generates deterministic output with seed", async () => {
    const body = {
      distribution: "uniform",
      count: 5,
      seed: 12345,
      params: { min: 10, max: 20 },
    };
    const r1 = await POST(makeReq(body));
    const r2 = await POST(makeReq(body));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect((await r1.json()).numbers).toEqual((await r2.json()).numbers);
  });

  it("uniform values stay within bounds", async () => {
    const res = await POST(
      makeReq({
        distribution: "uniform",
        count: 500,
        seed: 42,
        params: { min: -5, max: 5 },
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    body.numbers.forEach((n: number) => {
      expect(n).toBeGreaterThanOrEqual(-5);
      expect(n).toBeLessThan(5);
    });
  });

  it("normal distribution approximates requested mean", async () => {
    const res = await POST(
      makeReq({
        distribution: "normal",
        count: 6000,
        seed: 99,
        params: { mean: 50, stddev: 10 },
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mean(body.numbers)).toBeCloseTo(50, 0);
  });

  it("exponential values are non-negative", async () => {
    const res = await POST(
      makeReq({
        distribution: "exponential",
        count: 3000,
        seed: 77,
        params: { lambda: 2 },
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    body.numbers.forEach((n: number) => expect(n).toBeGreaterThanOrEqual(0));
  });

  it("poisson values are non-negative integers", async () => {
    const res = await POST(
      makeReq({
        distribution: "poisson",
        count: 2000,
        seed: 123,
        params: { lambda: 4 },
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    body.numbers.forEach((n: number) => {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    });
  });
});
