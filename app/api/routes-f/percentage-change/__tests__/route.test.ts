import { computePercentageChange } from "../route";

describe("computePercentageChange", () => {
  it("reports an increase", () => {
    expect(computePercentageChange(100, 150)).toEqual({
      percent_change: 50,
      absolute_change: 50,
      direction: "up",
    });
  });

  it("reports a decrease", () => {
    expect(computePercentageChange(200, 150)).toEqual({
      percent_change: -25,
      absolute_change: -50,
      direction: "down",
    });
  });

  it("reports no change", () => {
    expect(computePercentageChange(42, 42)).toEqual({
      percent_change: 0,
      absolute_change: 0,
      direction: "none",
    });
  });

  it("handles a zero base explicitly (null percent, still directional)", () => {
    expect(computePercentageChange(0, 10)).toEqual({
      percent_change: null,
      absolute_change: 10,
      direction: "up",
    });
  });

  it("treats 0 -> 0 as no change", () => {
    expect(computePercentageChange(0, 0)).toEqual({
      percent_change: 0,
      absolute_change: 0,
      direction: "none",
    });
  });
});
