import { fiscalQuarter } from "../route";

describe("fiscalQuarter", () => {
  it("uses the calendar year by default (Jan start)", () => {
    expect(fiscalQuarter("2026-02-15")).toEqual({
      quarter: 1,
      fiscal_year: 2026,
      quarter_start: "2026-01-01",
      quarter_end: "2026-03-31",
    });
    expect(fiscalQuarter("2026-08-10")).toEqual({
      quarter: 3,
      fiscal_year: 2026,
      quarter_start: "2026-07-01",
      quarter_end: "2026-09-30",
    });
  });

  it("handles an offset fiscal year (April start)", () => {
    // May is the first month of an April-start fiscal year -> Q1 of FY2026
    expect(fiscalQuarter("2026-05-15", 4)).toEqual({
      quarter: 1,
      fiscal_year: 2026,
      quarter_start: "2026-04-01",
      quarter_end: "2026-06-30",
    });
    // February falls in Q4 of the April-start fiscal year that began in 2025
    expect(fiscalQuarter("2026-02-15", 4)).toEqual({
      quarter: 4,
      fiscal_year: 2025,
      quarter_start: "2026-01-01",
      quarter_end: "2026-03-31",
    });
  });
});
