import { NextRequest } from "next/server";
import { POST } from "../route";
function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/date-diff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("POST /api/routes-f/date-diff", () => {
  it("handles leap-year calendar math", async () => {
    const res = await POST(
      makeReq({
        from: "2024-02-29T00:00:00Z",
        to: "2025-03-01T00:00:00Z",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.breakdown.years).toBe(1);
    expect(body.breakdown.months).toBe(0);
    expect(body.breakdown.days).toBe(1);
    expect(body.human).toContain("in");
  });
  it("captures DST spring-forward absolute delta", async () => {
    const res = await POST(
      makeReq({
        from: "2026-03-08T01:30:00-05:00",
        to: "2026-03-08T03:30:00-04:00",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_seconds).toBe(3600);
  });
  it("captures DST fall-back absolute delta", async () => {
    const res = await POST(
      makeReq({
        from: "2026-11-01T01:30:00-04:00",
        to: "2026-11-01T01:30:00-05:00",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_seconds).toBe(3600);
  });
  it("returns negative values when to is before from", async () => {
    const res = await POST(
      makeReq({
        from: "2026-01-01T12:00:00Z",
        to: "2026-01-01T09:00:00Z",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_seconds).toBe(-10800);
    expect(body.human.endsWith("ago")).toBe(true);
  });
  it("rejects invalid unit", async () => {
    const res = await POST(
      makeReq({
        from: "2026-01-01T12:00:00Z",
        to: "2026-01-01T13:00:00Z",
        unit: "seconds",
      })
    );
    expect(res.status).toBe(400);
  });
});
