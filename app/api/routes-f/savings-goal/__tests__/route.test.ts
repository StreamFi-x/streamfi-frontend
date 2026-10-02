/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/savings-goal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/savings-goal", () => {
  it("returns 0 months if goal is already met", async () => {
    const res = await POST(
      makeReq({ goal: 1000, initial: 1200, monthly_contribution: 100 })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.months_to_goal).toBe(0);
    expect(body.total_contributed).toBe(0);
    expect(body.total_interest).toBe(0);
    expect(body.final_balance).toBe(1200);
  });

  it("calculates timeline correctly without interest", async () => {
    const res = await POST(
      makeReq({
        goal: 1000,
        initial: 100,
        monthly_contribution: 100,
        annual_rate: 0,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.months_to_goal).toBe(9);
    expect(body.total_contributed).toBe(900);
    expect(body.total_interest).toBe(0);
    expect(body.final_balance).toBe(1000);
  });

  it("calculates timeline correctly with monthly compounded interest", async () => {
    // Goal: 1000, Initial: 500, Monthly Contribution: 100, Annual Rate: 12% (1% monthly rate)
    // Month 1: balance = 500 * 1.01 + 100 = 605
    // Month 2: balance = 605 * 1.01 + 100 = 711.05
    // Month 3: balance = 711.05 * 1.01 + 100 = 818.1605
    // Month 4: balance = 818.1605 * 1.01 + 100 = 926.3421
    // Month 5: balance = 926.3421 * 1.01 + 100 = 1035.6055 (reaches goal!)
    const res = await POST(
      makeReq({
        goal: 1000,
        initial: 500,
        monthly_contribution: 100,
        annual_rate: 12,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.months_to_goal).toBe(5);
    expect(body.total_contributed).toBe(500); // 5 * 100
    expect(body.total_interest).toBeCloseTo(35.61, 2);
    expect(body.final_balance).toBeCloseTo(1035.61, 2);
  });

  it("rejects impossible goals with 400", async () => {
    // No contribution and no interest
    let res = await POST(
      makeReq({
        goal: 1000,
        initial: 100,
        monthly_contribution: 0,
        annual_rate: 0,
      })
    );
    expect(res.status).toBe(400);

    // Initial is zero, monthly contribution is zero
    res = await POST(
      makeReq({
        goal: 1000,
        initial: 0,
        monthly_contribution: 0,
        annual_rate: 10,
      })
    );
    expect(res.status).toBe(400);

    // Negative contribution
    res = await POST(
      makeReq({
        goal: 1000,
        initial: 100,
        monthly_contribution: -10,
        annual_rate: 0,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid inputs", async () => {
    // Missing required fields
    let res = await POST(makeReq({ goal: 1000, initial: 100 }));
    expect(res.status).toBe(400);

    // Non-numeric types
    res = await POST(
      makeReq({
        goal: "abc",
        initial: 100,
        monthly_contribution: 10,
      })
    );
    expect(res.status).toBe(400);
  });
});
