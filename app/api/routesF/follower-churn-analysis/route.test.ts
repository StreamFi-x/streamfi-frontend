import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(query: string) {
  return new NextRequest(
    `http://localhost/api/routesF/follower-churn-analysis${query}`
  );
}

describe("/api/routesF/follower-churn-analysis", () => {
  it("computes the default 30-day churn window", async () => {
    const res = await GET(makeReq("?creator_id=creator-alpha"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.starting_followers).toBe(4);
    expect(data.gained).toBe(3);
    expect(data.lost).toBe(2);
    expect(data.ending).toBe(5);
    expect(data.churn_rate_percent).toBeCloseTo(50, 5);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq(""));

    expect(res.status).toBe(400);
  });

  it("returns 400 when window_days is invalid", async () => {
    const res = await GET(
      makeReq("?creator_id=creator-alpha&window_days=-5")
    );

    expect(res.status).toBe(400);
  });
});
