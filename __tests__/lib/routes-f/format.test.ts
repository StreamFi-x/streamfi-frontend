import { getPeriodKey } from "@/lib/routes-f/format";

describe("getPeriodKey", () => {
  it("groups by day", () => {
    expect(getPeriodKey("2026-03-27T10:00:00.000Z", "day")).toBe("2026-03-27");
  });

  it("groups by week using monday as the start of the week", () => {
    expect(getPeriodKey("2026-03-27T10:00:00.000Z", "week")).toBe("2026-03-23");
  });

  it("groups by month", () => {
    expect(getPeriodKey("2026-03-27T10:00:00.000Z", "month")).toBe(
      "2026-03-01"
    );
  });
});
