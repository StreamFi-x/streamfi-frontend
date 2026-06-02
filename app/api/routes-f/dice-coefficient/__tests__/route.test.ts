import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/dice-coefficient", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/dice-coefficient", () => {
  it("returns 1 for identical strings", async () => {
    const res = await POST(makeReq({ a: "Hello", b: "hello" }));
    const body = await res.json();
    expect(body.coefficient).toBe(1);
  });

  it("returns 0 for disjoint strings", async () => {
    const res = await POST(makeReq({ a: "ab", b: "xy" }));
    const body = await res.json();
    expect(body.coefficient).toBe(0);
  });

  it("returns fractional value for partial overlap", async () => {
    const res = await POST(makeReq({ a: "night", b: "nacht" }));
    const body = await res.json();
    expect(body.coefficient).toBeGreaterThan(0);
    expect(body.coefficient).toBeLessThan(1);
  });
});
