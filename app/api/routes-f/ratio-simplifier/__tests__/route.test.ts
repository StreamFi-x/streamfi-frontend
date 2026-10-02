/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/ratio-simplifier", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/ratio-simplifier", () => {
  it("simplifies a reducible fraction successfully", async () => {
    const res = await POST(makeReq({ numerator: 10, denominator: 20 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.simplified).toBe("1:2");
    expect(body.numerator).toBe(1);
    expect(body.denominator).toBe(2);
    expect(body.decimal).toBe(0.5);
    expect(body.gcd).toBe(10);
  });

  it("handles already simplified ratios", async () => {
    const res = await POST(makeReq({ numerator: 3, denominator: 7 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.simplified).toBe("3:7");
    expect(body.numerator).toBe(3);
    expect(body.denominator).toBe(7);
    expect(body.decimal).toBeCloseTo(3 / 7, 5);
    expect(body.gcd).toBe(1);
  });

  it("simplifies a ratio format string 'a:b'", async () => {
    const res = await POST(makeReq({ ratio: "15:20" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.simplified).toBe("3:4");
    expect(body.numerator).toBe(3);
    expect(body.denominator).toBe(4);
    expect(body.decimal).toBe(0.75);
    expect(body.gcd).toBe(5);
  });

  it("handles negative numbers and normalizes denominator sign", async () => {
    // case 1: negative numerator
    let res = await POST(makeReq({ numerator: -5, denominator: 10 }));
    let body = await res.json();
    expect(res.status).toBe(200);
    expect(body.simplified).toBe("-1:2");
    expect(body.numerator).toBe(-1);
    expect(body.denominator).toBe(2);

    // case 2: negative denominator
    res = await POST(makeReq({ numerator: 5, denominator: -10 }));
    body = await res.json();
    expect(res.status).toBe(200);
    expect(body.simplified).toBe("-1:2");
    expect(body.numerator).toBe(-1);
    expect(body.denominator).toBe(2);

    // case 3: both negative
    res = await POST(makeReq({ numerator: -5, denominator: -10 }));
    body = await res.json();
    expect(res.status).toBe(200);
    expect(body.simplified).toBe("1:2");
    expect(body.numerator).toBe(1);
    expect(body.denominator).toBe(2);
  });

  it("rejects zero denominator with 400", async () => {
    const res = await POST(makeReq({ numerator: 5, denominator: 0 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("cannot be zero");
  });

  it("simplifies float ratios correctly", async () => {
    const res = await POST(makeReq({ ratio: "1.5:3.0" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.simplified).toBe("1:2");
    expect(body.numerator).toBe(1);
    expect(body.denominator).toBe(2);
    expect(body.decimal).toBe(0.5);
  });

  it("rejects invalid inputs", async () => {
    // Invalid ratio string format
    let res = await POST(makeReq({ ratio: "15" }));
    expect(res.status).toBe(400);

    // Non-numeric components
    res = await POST(makeReq({ ratio: "abc:def" }));
    expect(res.status).toBe(400);

    // Missing fields entirely
    res = await POST(makeReq({}));
    expect(res.status).toBe(400);

    // Boolean fields (which Number() might coerce to 1/0 otherwise)
    res = await POST(makeReq({ numerator: true, denominator: 5 }));
    expect(res.status).toBe(400);
  });
});
