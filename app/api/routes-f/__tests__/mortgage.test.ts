/**
 * @jest-environment node
 */
import { POST } from "../mortgage/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/mortgage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/mortgage", () => {
  // --- Typical 30-year mortgage ---
  it("computes typical 30-year mortgage", async () => {
    const res = await POST(
      makeReq({
        home_price: 300000,
        down_payment: 60000,
        annual_rate: 6.5,
        years: 30,
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.loan_amount).toBe(240000);
    expect(d.monthly_principal_interest).toBeCloseTo(1517.09, 0);
    expect(d.monthly_taxes).toBe(0);
    expect(d.monthly_insurance).toBe(0);
    expect(d.monthly_hoa).toBe(0);
    expect(d.monthly_total).toBeCloseTo(1517.09, 0);
    expect(d.total_interest).toBeGreaterThan(0);
    expect(d.total_paid).toBeGreaterThan(d.loan_amount);
    expect(d.ltv_ratio).toBe(80);
    expect(typeof d.payoff_date).toBe("string");
  });

  // --- No extras (bare minimum) ---
  it("computes mortgage with no extras", async () => {
    const res = await POST(
      makeReq({
        home_price: 200000,
        down_payment: 40000,
        annual_rate: 5,
        years: 15,
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.loan_amount).toBe(160000);
    expect(d.monthly_taxes).toBe(0);
    expect(d.monthly_insurance).toBe(0);
    expect(d.monthly_hoa).toBe(0);
    expect(d.ltv_ratio).toBe(80);
  });

  // --- With all fees ---
  it("computes mortgage with all fees", async () => {
    const res = await POST(
      makeReq({
        home_price: 400000,
        down_payment: 80000,
        annual_rate: 7,
        years: 30,
        property_tax_annual: 4800,
        insurance_annual: 1200,
        hoa_monthly: 300,
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.monthly_taxes).toBe(400);
    expect(d.monthly_insurance).toBe(100);
    expect(d.monthly_hoa).toBe(300);
    expect(d.monthly_total).toBeGreaterThan(d.monthly_principal_interest);
  });

  // --- Zero interest rate ---
  it("handles zero interest rate", async () => {
    const res = await POST(
      makeReq({
        home_price: 120000,
        down_payment: 0,
        annual_rate: 0,
        years: 10,
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.monthly_principal_interest).toBe(1000);
    expect(d.total_interest).toBe(0);
  });

  // --- Validation: years > 50 ---
  it("rejects years > 50", async () => {
    const res = await POST(
      makeReq({
        home_price: 300000,
        down_payment: 60000,
        annual_rate: 6,
        years: 51,
      })
    );
    expect(res.status).toBe(400);
  });

  // --- Validation: negative home price ---
  it("rejects negative home_price", async () => {
    const res = await POST(
      makeReq({
        home_price: -100000,
        down_payment: 0,
        annual_rate: 5,
        years: 30,
      })
    );
    expect(res.status).toBe(400);
  });

  // --- Validation: down payment >= home price ---
  it("rejects down_payment >= home_price", async () => {
    const res = await POST(
      makeReq({
        home_price: 200000,
        down_payment: 200000,
        annual_rate: 5,
        years: 30,
      })
    );
    expect(res.status).toBe(400);
  });

  // --- Invalid JSON ---
  it("rejects invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/mortgage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // --- Cent precision check ---
  it("returns cent precision (2 decimal places)", async () => {
    const res = await POST(
      makeReq({
        home_price: 333333,
        down_payment: 33333,
        annual_rate: 4.375,
        years: 30,
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    const decimals = (n: number) => {
      const parts = String(n).split(".");
      return parts.length > 1 ? parts[1].length : 0;
    };
    expect(decimals(d.monthly_principal_interest)).toBeLessThanOrEqual(2);
    expect(decimals(d.loan_amount)).toBeLessThanOrEqual(2);
    expect(decimals(d.total_interest)).toBeLessThanOrEqual(2);
  });
});
