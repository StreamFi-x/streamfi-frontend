/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../creator-dashboard/route";

function makeGet(creatorId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/creator-dashboard?creator_id=${creatorId}`
  );
}

describe("GET /api/routes-f/creator-dashboard", () => {
  it("returns all five metric fields for a known creator", async () => {
    const res = await GET(makeGet("creator_001"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.follower_count).toBe("number");
    expect(typeof data.monthly_recurring_revenue_usdc).toBe("number");
    expect(typeof data.total_tips_lifetime_usdc).toBe("number");
    expect(typeof data.active_subs).toBe("number");
    expect("last_stream_at" in data).toBe(true);
  });

  it("returns correct values for creator_001", async () => {
    const res = await GET(makeGet("creator_001"));
    const data = await res.json();
    expect(data.follower_count).toBe(14823);
    expect(data.active_subs).toBe(312);
    expect(data.last_stream_at).toBe("2026-06-25T20:00:00Z");
  });

  it("returns null last_stream_at for creator who has never streamed", async () => {
    const res = await GET(makeGet("creator_003"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.last_stream_at).toBeNull();
    expect(data.active_subs).toBe(0);
  });

  it("rounds MRR to 2 decimal places", async () => {
    const res = await GET(makeGet("creator_001"));
    const data = await res.json();
    const decimals = (data.monthly_recurring_revenue_usdc.toString().split(".")[1] ?? "").length;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it("rounds total_tips_lifetime_usdc to 2 decimal places", async () => {
    const res = await GET(makeGet("creator_003"));
    const data = await res.json();
    expect(data.total_tips_lifetime_usdc).toBe(12.33);
  });
});
