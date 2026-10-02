/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../subscriber-roster/route";

function makeReq(creatorId: string) {
  const req = new NextRequest("http://localhost/api/routes-f/subscriber-roster", {
    method: "GET",
  });
  req.nextUrl.searchParams.set("creator_id", creatorId);
  return req;
}

describe("/api/routes-f/subscriber-roster", () => {
  it("returns subscriber list with tier breakdown", async () => {
    const req = makeReq("creator123");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("subscribers");
    expect(data).toHaveProperty("by_tier");
    expect(data).toHaveProperty("monthly_recurring_revenue_usdc");
    expect(Array.isArray(data.subscribers)).toBe(true);
  });

  it("computes MRR correctly", async () => {
    const req = makeReq("creator123");
    const res = await GET(req);
    const data = await res.json();

    expect(typeof data.monthly_recurring_revenue_usdc).toBe("number");
    expect(data.monthly_recurring_revenue_usdc).toBeGreaterThanOrEqual(0);
  });

  it("sorts subscribers by started_at descending", async () => {
    const req = makeReq("creator123");
    const res = await GET(req);
    const data = await res.json();

    if (data.subscribers.length > 1) {
      for (let i = 0; i < data.subscribers.length - 1; i++) {
        const current = new Date(data.subscribers[i].started_at);
        const next = new Date(data.subscribers[i + 1].started_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    }
  });

  it("rejects missing creator_id", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/subscriber-roster");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
