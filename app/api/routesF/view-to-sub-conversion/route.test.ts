import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(query: string) {
  return new NextRequest(
    `http://localhost/api/routesF/view-to-sub-conversion${query}`
  );
}

describe("/api/routesF/view-to-sub-conversion", () => {
  it("computes the default 30-day conversion window", async () => {
    const res = await GET(makeReq("?creator_id=creator-alpha"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total_viewers).toBe(5);
    expect(data.new_subs).toBe(2);
    expect(data.conversion_percent).toBeCloseTo(40, 5);
  });

  it("narrows the conversion window when window_days is provided", async () => {
    const res = await GET(
      makeReq("?creator_id=creator-alpha&window_days=7")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total_viewers).toBe(3);
    expect(data.new_subs).toBe(2);
    expect(data.conversion_percent).toBeCloseTo(66.6667, 4);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq(""));

    expect(res.status).toBe(400);
  });

  it("returns 400 when window_days is invalid", async () => {
    const res = await GET(
      makeReq("?creator_id=creator-alpha&window_days=zero")
    );

    expect(res.status).toBe(400);
  });
});
