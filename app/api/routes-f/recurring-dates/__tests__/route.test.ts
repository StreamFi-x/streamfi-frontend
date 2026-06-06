/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, generateSeries, MAX_DATES } from "../route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/recurring-dates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("generateSeries", () => {
  it("includes the start as the first occurrence", () => {
    const { dates } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "daily",
      interval: 1,
      count: 3,
    });
    expect(dates[0]).toBe("2024-01-01T00:00:00.000Z");
  });

  it("generates daily series", () => {
    const { dates, count } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "daily",
      interval: 1,
      count: 3,
    });
    expect(count).toBe(3);
    expect(dates).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-01-02T00:00:00.000Z",
      "2024-01-03T00:00:00.000Z",
    ]);
  });

  it("generates weekly series and honours interval", () => {
    const { dates } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "weekly",
      interval: 2,
      count: 3,
    });
    expect(dates).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-01-15T00:00:00.000Z",
      "2024-01-29T00:00:00.000Z",
    ]);
  });

  it("generates monthly series", () => {
    const { dates } = generateSeries({
      start: new Date("2024-01-15T09:30:00Z"),
      frequency: "monthly",
      interval: 1,
      count: 3,
    });
    expect(dates).toEqual([
      "2024-01-15T09:30:00.000Z",
      "2024-02-15T09:30:00.000Z",
      "2024-03-15T09:30:00.000Z",
    ]);
  });

  it("generates yearly series", () => {
    const { dates } = generateSeries({
      start: new Date("2020-06-01T00:00:00Z"),
      frequency: "yearly",
      interval: 1,
      count: 3,
    });
    expect(dates).toEqual([
      "2020-06-01T00:00:00.000Z",
      "2021-06-01T00:00:00.000Z",
      "2022-06-01T00:00:00.000Z",
    ]);
  });

  it("clamps month-end overflow and preserves the original anchor day", () => {
    // Jan 31 monthly: Feb has no 31st, so clamp; but later months that DO have
    // a 31st must restore it (anchored to the original day, not the clamp).
    const { dates } = generateSeries({
      start: new Date("2024-01-31T00:00:00Z"),
      frequency: "monthly",
      interval: 1,
      count: 5,
    });
    expect(dates).toEqual([
      "2024-01-31T00:00:00.000Z",
      "2024-02-29T00:00:00.000Z", // 2024 is a leap year
      "2024-03-31T00:00:00.000Z",
      "2024-04-30T00:00:00.000Z",
      "2024-05-31T00:00:00.000Z",
    ]);
  });

  it("clamps Feb 29 yearly to Feb 28 in non-leap years and restores it on leap years", () => {
    const { dates } = generateSeries({
      start: new Date("2024-02-29T00:00:00Z"),
      frequency: "yearly",
      interval: 1,
      count: 5,
    });
    expect(dates).toEqual([
      "2024-02-29T00:00:00.000Z",
      "2025-02-28T00:00:00.000Z",
      "2026-02-28T00:00:00.000Z",
      "2027-02-28T00:00:00.000Z",
      "2028-02-29T00:00:00.000Z", // leap year again
    ]);
  });

  it("stops at the `until` bound (inclusive)", () => {
    const { dates, count } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "daily",
      interval: 1,
      until: new Date("2024-01-03T00:00:00Z"),
    });
    expect(count).toBe(3);
    expect(dates[dates.length - 1]).toBe("2024-01-03T00:00:00.000Z");
  });

  it("returns only the start when `until` falls between occurrences", () => {
    const { dates } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "weekly",
      interval: 1,
      until: new Date("2024-01-05T00:00:00Z"),
    });
    expect(dates).toEqual(["2024-01-01T00:00:00.000Z"]);
  });

  it("stops at whichever of count/until comes first", () => {
    const { count } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "daily",
      interval: 1,
      count: 100,
      until: new Date("2024-01-05T00:00:00Z"),
    });
    expect(count).toBe(5);
  });

  it("caps the output at MAX_DATES", () => {
    const { dates, count } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "daily",
      interval: 1,
      count: 5000,
    });
    expect(count).toBe(MAX_DATES);
    expect(dates).toHaveLength(MAX_DATES);
  });

  it("caps an unbounded rule (no count, no until) at MAX_DATES", () => {
    const { count } = generateSeries({
      start: new Date("2024-01-01T00:00:00Z"),
      frequency: "daily",
      interval: 1,
    });
    expect(count).toBe(MAX_DATES);
  });
});

describe("POST /api/routes-f/recurring-dates", () => {
  it("returns a series for a valid rule", async () => {
    const res = await POST(
      postReq({ start: "2024-01-01T00:00:00Z", frequency: "daily", count: 2 })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      dates: ["2024-01-01T00:00:00.000Z", "2024-01-02T00:00:00.000Z"],
      count: 2,
    });
  });

  it("defaults interval to 1 when omitted", async () => {
    const res = await POST(
      postReq({ start: "2024-01-01T00:00:00Z", frequency: "weekly", count: 2 })
    );
    const body = await res.json();
    expect(body.dates).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-01-08T00:00:00.000Z",
    ]);
  });

  it("rejects an invalid frequency", async () => {
    const res = await POST(
      postReq({ start: "2024-01-01T00:00:00Z", frequency: "hourly", count: 2 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid request body");
  });

  it("rejects an invalid start date", async () => {
    const res = await POST(
      postReq({ start: "not-a-date", frequency: "daily", count: 2 })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-positive interval", async () => {
    const res = await POST(
      postReq({
        start: "2024-01-01T00:00:00Z",
        frequency: "daily",
        interval: 0,
        count: 2,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects `until` before `start`", async () => {
    const res = await POST(
      postReq({
        start: "2024-01-10T00:00:00Z",
        frequency: "daily",
        until: "2024-01-01T00:00:00Z",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/recurring-dates",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ not json",
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
  });
});
