/**
 * @jest-environment node
 */
import { POST } from "../loan-amortization/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/loan-amortization", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/loan-amortization", () => {
  it("computes basic loan schedule", async () => {
    const res = await POST(makeReq({ principal: 100000, annual_rate: 5, years: 30 }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.monthly_payment).toBeCloseTo(536.82, 0);
    // 360 months theoretical; rounding to cents can add 1 extra month
    expect(d.payoff_months).toBeGreaterThanOrEqual(360);
    expect(d.payoff_months).toBeLessThanOrEqual(362);
    expect(Array.isArray(d.schedule)).toBe(true);
    expect(d.schedule.length).toBe(d.payoff_months);
    expect(d.schedule[0].month).toBe(1);
    expect(d.schedule[d.payoff_months - 1].balance).toBe(0);
  });

  it("accelerates payoff with extra monthly payment", async () => {
    const baseRes = await POST(makeReq({ principal: 100000, annual_rate: 5, years: 30 }));
    const base = await baseRes.json();

    const extraRes = await POST(makeReq({ principal: 100000, annual_rate: 5, years: 30, extra_monthly_payment: 200 }));
    const extra = await extraRes.json();

    expect(extra.payoff_months).toBeLessThan(base.payoff_months);
    expect(extra.total_interest).toBeLessThan(base.total_interest);
  });

  it("handles zero interest rate", async () => {
    const res = await POST(makeReq({ principal: 12000, annual_rate: 0, years: 1 }));
    const d = await res.json();
    expect(d.monthly_payment).toBe(1000);
    expect(d.total_interest).toBe(0);
  });

  it("schedule first row has correct structure", async () => {
    const res = await POST(makeReq({ principal: 10000, annual_rate: 6, years: 1 }));
    const { schedule } = await res.json();
    const row = schedule[0];
    expect(typeof row.month).toBe("number");
    expect(typeof row.payment).toBe("number");
    expect(typeof row.principal).toBe("number");
    expect(typeof row.interest).toBe("number");
    expect(typeof row.balance).toBe("number");
  });

  it("rejects negative principal", async () => {
    const res = await POST(makeReq({ principal: -1000, annual_rate: 5, years: 10 }));
    expect(res.status).toBe(400);
  });

  it("rejects years > 50", async () => {
    const res = await POST(makeReq({ principal: 10000, annual_rate: 5, years: 51 }));
    expect(res.status).toBe(400);
  });

  it("rejects negative rate", async () => {
    const res = await POST(makeReq({ principal: 10000, annual_rate: -1, years: 10 }));
    expect(res.status).toBe(400);
  });
});
