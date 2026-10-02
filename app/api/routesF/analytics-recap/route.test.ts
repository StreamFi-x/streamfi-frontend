import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/analytics-recap");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Shareable Analytics Recap", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq({ month: "2024-06" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when month is missing", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed month", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1", month: "June-2024" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no recap exists for the creator/month combo", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1", month: "2024-01" }));
    expect(res.status).toBe(404);
  });

  it("returns a recap for a known month", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1", month: "2024-06" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.title).toBe("string");
    expect(data.title).toContain("2024-06");
    expect(Array.isArray(data.highlights)).toBe(true);
    expect(data.highlights.length).toBeGreaterThan(0);
  });

  it("returns structured stats suitable for client-side image generation", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1", month: "2024-06" }));
    const data = await res.json();

    expect(data.stats).toHaveProperty("total_streams");
    expect(data.stats).toHaveProperty("total_hours_streamed");
    expect(data.stats).toHaveProperty("new_subscribers");
    expect(data.stats).toHaveProperty("total_tips_usdc");
    expect(data.stats).toHaveProperty("peak_viewers");
  });

  it("does not return image data (non-image, metadata only)", async () => {
    const res = await GET(makeReq({ creator_id: "creator-1", month: "2024-06" }));
    const data = await res.json();
    expect(data).not.toHaveProperty("image_url");
    expect(data).not.toHaveProperty("image");
  });
});
