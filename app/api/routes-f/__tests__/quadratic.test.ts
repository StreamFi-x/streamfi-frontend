/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../quadratic/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/quadratic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/quadratic", () => {
  it("solves equation with two real distinct roots: x^2 - 5x + 6 = 0", async () => {
    const res = await POST(makeReq({ a: 1, b: -5, c: 6 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.has_complex_roots).toBe(false);
    expect(data.discriminant).toBe(1);
    const reals = data.roots.map((r: { real: number }) => r.real).sort();
    expect(reals[0]).toBeCloseTo(2);
    expect(reals[1]).toBeCloseTo(3);
  });

  it("solves equation with repeated root: x^2 - 2x + 1 = 0", async () => {
    const res = await POST(makeReq({ a: 1, b: -2, c: 1 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.has_complex_roots).toBe(false);
    expect(data.discriminant).toBe(0);
    expect(data.roots[0].real).toBeCloseTo(1);
    expect(data.roots[1].real).toBeCloseTo(1);
  });

  it("solves equation with complex roots: x^2 + 1 = 0", async () => {
    const res = await POST(makeReq({ a: 1, b: 0, c: 1 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.has_complex_roots).toBe(true);
    expect(data.discriminant).toBe(-4);
    expect(data.roots[0].real).toBeCloseTo(0);
    expect(data.roots[0].imaginary).toBeCloseTo(1);
    expect(data.roots[1].imaginary).toBeCloseTo(-1);
  });

  it("returns correct vertex: x^2 - 4x + 3", async () => {
    const res = await POST(makeReq({ a: 1, b: -4, c: 3 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.vertex.x).toBeCloseTo(2);
    expect(data.vertex.y).toBeCloseTo(-1);
    expect(data.axis_of_symmetry).toBeCloseTo(2);
  });

  it("rejects a == 0 with 400", async () => {
    const res = await POST(makeReq({ a: 0, b: 2, c: 1 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/linear/i);
  });

  it("rejects non-finite values", async () => {
    const res = await POST(makeReq({ a: Infinity, b: 1, c: 1 }));
    expect(res.status).toBe(400);
  });

  it("rejects missing coefficients", async () => {
    const res = await POST(makeReq({ a: 1, b: 2 }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/quadratic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
