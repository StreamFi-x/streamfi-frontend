/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/cagr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/cagr", () => {
  it("calculates CAGR for a known growth example", async () => {
    const res = await POST(
      makeReq({ begin_value: 1000, end_value: 2000, years: 5 })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cagr_percent).toBeCloseTo(14.869835, 5);
  });

  it("calculates negative CAGR when value declines", async () => {
    const res = await POST(
      makeReq({ begin_value: 1000, end_value: 500, years: 5 })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cagr_percent).toBeCloseTo(-12.944943, 5);
  });

  it("rejects non-positive values and years", async () => {
    const res = await POST(
      makeReq({ begin_value: 0, end_value: 1000, years: 5 })
    );
    const yearsRes = await POST(
      makeReq({ begin_value: 1000, end_value: 1100, years: -1 })
    );

    expect(res.status).toBe(400);
    expect(yearsRes.status).toBe(400);
  });
});
