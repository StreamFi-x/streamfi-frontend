/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../business-days/route";

type RequestBody = {
  date: string;
  days: number;
  country?: string;
  custom_holidays?: string[];
};

function makeReq(body: RequestBody) {
  return new NextRequest("http://localhost/api/routesF/business-days", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/business-days", () => {
  it("adds one business day and skips a weekend", async () => {
    const res = await POST(
      makeReq({ date: "2026-03-13", days: 1 })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2026-03-15T00:00:00.000Z");
    expect(data.skipped_days).toBe(2);
  });

  it("subtracts one business day and skips a weekend", async () => {
    const res = await POST(
      makeReq({ date: "2026-03-15", days: -1 })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2026-03-13T00:00:00.000Z");
    expect(data.skipped_days).toBe(2);
  });

  it("skips a holiday from bundled country holidays", async () => {
    const res = await POST(
      makeReq({ date: "2026-12-24", days: 1, country: "US" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2026-12-27T00:00:00.000Z");
    expect(data.skipped_days).toBe(3);
  });

  it("uses custom_holidays to skip additional dates", async () => {
    const res = await POST(
      makeReq({
        date: "2026-03-13",
        days: 1,
        custom_holidays: ["2026-03-15"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("2026-03-16T00:00:00.000Z");
    expect(data.skipped_days).toBe(2);
  });

  it("rejects invalid date values", async () => {
    const res = await POST(makeReq({ date: "invalid", days: 1 } as unknown as RequestBody));
    expect(res.status).toBe(400);
  });

  it("rejects non-integer days", async () => {
    const req = new NextRequest("http://localhost/api/routesF/business-days", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-03-13", days: 1.5 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
