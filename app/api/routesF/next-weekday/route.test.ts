import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/next-weekday", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/next-weekday", () => {
  it("returns the same day when include_today is true", async () => {
    const res = await POST(
      makeReq({
        weekday: "thu",
        from: "2026-05-28T15:45:00.000Z",
        include_today: true,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.date).toBe("2026-05-28T00:00:00.000Z");
    expect(data.days_until).toBe(0);
  });

  it("wraps to the following week when include_today is false", async () => {
    const res = await POST(
      makeReq({
        weekday: 4,
        from: "2026-05-28T15:45:00.000Z",
      })
    );
    const data = await res.json();

    expect(data.date).toBe("2026-06-04T00:00:00.000Z");
    expect(data.days_until).toBe(7);
  });

  it("handles a later weekday in the same week", async () => {
    const res = await POST(
      makeReq({
        weekday: "sun",
        from: "2026-05-28T15:45:00.000Z",
      })
    );
    const data = await res.json();

    expect(data.date).toBe("2026-05-31T00:00:00.000Z");
    expect(data.days_until).toBe(3);
  });

  it("rejects invalid weekday input", async () => {
    const res = await POST(makeReq({ weekday: "someday" }));

    expect(res.status).toBe(400);
  });
});
