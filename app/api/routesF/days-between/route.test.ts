/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/days-between", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routesF/days-between", () => {
  it("returns zero for the same day", async () => {
    const res = await POST(makeReq({ from: "2026-05-28", to: "2026-05-28" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      calendar_days: 0,
      business_days: 0,
      weekends: 0,
      holidays_in_range: [],
    });
  });

  it("handles reversed date order", async () => {
    const res = await POST(makeReq({ from: "2026-05-04", to: "2026-05-01" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.calendar_days).toBe(3);
    expect(body.weekends).toBe(2);
    expect(body.business_days).toBe(1);
  });

  it("excludes holidays from business days", async () => {
    const res = await POST(
      makeReq({ from: "2026-01-01", to: "2026-01-03", country: "US" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.calendar_days).toBe(2);
    expect(body.business_days).toBe(1);
    expect(body.holidays_in_range).toEqual([
      { date: "2026-01-01", name: "New Year's Day" },
    ]);
  });

  it("uses country-specific holidays", async () => {
    const res = await POST(
      makeReq({ from: "2026-10-01", to: "2026-10-02", country: "NG" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.business_days).toBe(0);
    expect(body.holidays_in_range[0]).toEqual({
      date: "2026-10-01",
      name: "Independence Day",
    });
  });
});
