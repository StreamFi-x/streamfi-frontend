/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../gcd-lcm/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/gcd-lcm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/gcd-lcm", () => {
  it("computes gcd and lcm of a known pair (12, 18)", async () => {
    const res = await POST(makeReq({ numbers: [12, 18] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gcd).toBe(6);
    expect(data.lcm).toBe(36);
    expect(data.n_count).toBe(2);
  });

  it("computes gcd only when operation=gcd", async () => {
    const res = await POST(makeReq({ numbers: [12, 18], operation: "gcd" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gcd).toBe(6);
    expect(data.lcm).toBeUndefined();
  });

  it("computes lcm only when operation=lcm", async () => {
    const res = await POST(makeReq({ numbers: [12, 18], operation: "lcm" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.lcm).toBe(36);
    expect(data.gcd).toBeUndefined();
  });

  it("handles multiple numbers", async () => {
    const res = await POST(makeReq({ numbers: [4, 6, 8] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gcd).toBe(2);
    expect(data.lcm).toBe(24);
    expect(data.n_count).toBe(3);
  });

  it("handles edge case with 1", async () => {
    const res = await POST(makeReq({ numbers: [1, 7] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gcd).toBe(1);
    expect(data.lcm).toBe(7);
  });

  it("handles prime numbers", async () => {
    const res = await POST(makeReq({ numbers: [7, 11] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gcd).toBe(1);
    expect(data.lcm).toBe(77);
  });

  it("handles single number", async () => {
    const res = await POST(makeReq({ numbers: [15] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gcd).toBe(15);
    expect(data.lcm).toBe(15);
  });

  it("rejects non-positive integers", async () => {
    const res = await POST(makeReq({ numbers: [0, 5] }));
    expect(res.status).toBe(400);
  });

  it("rejects floats", async () => {
    const res = await POST(makeReq({ numbers: [1.5, 3] }));
    expect(res.status).toBe(400);
  });

  it("rejects arrays exceeding 100 numbers", async () => {
    const numbers = Array.from({ length: 101 }, (_, i) => i + 1);
    const res = await POST(makeReq({ numbers }));
    expect(res.status).toBe(400);
  });

  it("rejects empty array", async () => {
    const res = await POST(makeReq({ numbers: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid operation", async () => {
    const res = await POST(makeReq({ numbers: [4, 6], operation: "max" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/gcd-lcm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
