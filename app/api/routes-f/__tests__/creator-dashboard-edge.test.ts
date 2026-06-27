/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../creator-dashboard/route";
import { roundUsdc } from "../creator-dashboard/currency";

function makeGet(qs: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/creator-dashboard?${qs}`
  );
}

describe("GET /api/routes-f/creator-dashboard — edge cases", () => {
  it("returns 404 for unknown creator_id", async () => {
    const res = await GET(makeGet("creator_id=creator_999"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routes-f/creator-dashboard")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is empty string", async () => {
    const res = await GET(makeGet("creator_id="));
    expect(res.status).toBe(400);
  });
});

describe("roundUsdc utility", () => {
  it("rounds down correctly", () => {
    expect(roundUsdc(12.333)).toBe(12.33);
  });

  it("rounds up correctly", () => {
    expect(roundUsdc(12.335)).toBe(12.34);
  });

  it("leaves exact 2-decimal values unchanged", () => {
    expect(roundUsdc(100.5)).toBe(100.5);
    expect(roundUsdc(0.0)).toBe(0);
  });

  it("handles zero", () => {
    expect(roundUsdc(0)).toBe(0);
  });
});
