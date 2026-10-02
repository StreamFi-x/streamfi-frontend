/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { addIntervalsToDate } from "./calendar";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/date-interval", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/date-interval", () => {
  it("clamps Jan 31 plus one month to the last day of February", async () => {
    const res = await POST(
      makeReq({ date: "2023-01-31T12:00:00.000Z", add: { months: 1 } })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2023-02-28T12:00:00.000Z");
  });

  it("clamps Jan 31 plus one month in a leap year to Feb 29", async () => {
    const res = await POST(
      makeReq({ date: "2024-01-31T00:00:00.000Z", add: { months: 1 } })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2024-02-29T00:00:00.000Z");
  });

  it("supports negative month intervals", async () => {
    const res = await POST(
      makeReq({ date: "2023-03-31T08:30:00.000Z", add: { months: -1 } })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2023-02-28T08:30:00.000Z");
  });

  it("supports negative day intervals", async () => {
    const res = await POST(
      makeReq({ date: "2024-03-15T10:00:00.000Z", add: { days: -5 } })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2024-03-10T10:00:00.000Z");
  });

  it("adds hours and minutes", async () => {
    const res = await POST(
      makeReq({ date: "2024-06-01T10:00:00.000Z", add: { hours: 2, minutes: 30 } })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2024-06-01T12:30:00.000Z");
  });

  it("rejects invalid dates", async () => {
    const res = await POST(makeReq({ date: "not-a-date", add: { days: 1 } }));
    expect(res.status).toBe(400);
  });
});

describe("addIntervalsToDate", () => {
  it("clamps Feb 29 when adding years to a non-leap year", () => {
    expect(addIntervalsToDate("2024-02-29T00:00:00.000Z", { years: 1 })).toBe(
      "2025-02-28T00:00:00.000Z"
    );
  });
});
