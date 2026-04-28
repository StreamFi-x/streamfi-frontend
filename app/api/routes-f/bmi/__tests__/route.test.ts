import { POST } from "../route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/bmi";

function req(body: object) {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /bmi", () => {
  it("calculates BMI for metric units", async () => {
    const res = await POST(req({ weight: 70, height: 175, unit: "metric" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.bmi).toBe(22.9);
    expect(body.category).toBe("Normal weight");
    expect(body.ideal_weight_range.unit).toBe("kg");
    expect(body.disclaimer).toMatch(/screening tool/i);
  });

  it("calculates BMI for imperial units", async () => {
    const res = await POST(req({ weight: 180, height: 70, unit: "imperial" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.bmi).toBe(25.8);
    expect(body.category).toBe("Overweight");
    expect(body.ideal_weight_range.unit).toBe("lbs");
  });

  it("covers all WHO categories", async () => {
    const cases = [
      { bmi: 17, category: "Underweight" },
      { bmi: 22, category: "Normal weight" },
      { bmi: 27, category: "Overweight" },
      { bmi: 32, category: "Obesity class I" },
      { bmi: 37, category: "Obesity class II" },
      { bmi: 42, category: "Obesity class III" },
    ];

    const heightCm = 100;

    for (const testCase of cases) {
      const weightKg = testCase.bmi;
      const res = await POST(req({ weight: weightKg, height: heightCm, unit: "metric" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.category).toBe(testCase.category);
    }
  });
});
