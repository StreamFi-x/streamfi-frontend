import { roundValue } from "../route";

describe("roundValue", () => {
  it("half_up rounds .5 away from zero", () => {
    expect(roundValue(2.5, "half_up")).toBe(3);
    expect(roundValue(3.5, "half_up")).toBe(4);
    expect(roundValue(-2.5, "half_up")).toBe(-3);
  });

  it("half_even uses banker's rounding on .5", () => {
    expect(roundValue(2.5, "half_even")).toBe(2);
    expect(roundValue(3.5, "half_even")).toBe(4);
    expect(roundValue(0.5, "half_even")).toBe(0);
    expect(roundValue(1.5, "half_even")).toBe(2);
    expect(roundValue(-2.5, "half_even")).toBe(-2);
  });

  it("ceil / floor / trunc", () => {
    expect(roundValue(2.1, "ceil")).toBe(3);
    expect(roundValue(2.9, "floor")).toBe(2);
    expect(roundValue(-2.9, "trunc")).toBe(-2);
    expect(roundValue(2.9, "trunc")).toBe(2);
  });

  it("respects decimals", () => {
    expect(roundValue(2.345, "floor", 2)).toBe(2.34);
    expect(roundValue(2.5, "ceil", 0)).toBe(3);
  });
});
