import {
  GET,
  POST,
  recordImpression,
  recordClick,
  getStreamStats,
} from "./route";
import { NextRequest } from "next/server";

describe("Stream card impression tracking", () => {
  const streamId = "stream-test-99";

  it("records impressions and clicks and computes correct CTR and source breakdown", async () => {
    // Record 100 impressions for explore, 10 clicks
    for (let i = 0; i < 100; i++) {
      recordImpression(streamId, "explore");
    }
    for (let i = 0; i < 10; i++) {
      recordClick(streamId, "explore");
    }

    // Record 50 impressions for category, 10 clicks
    for (let i = 0; i < 50; i++) {
      recordImpression(streamId, "category");
    }
    for (let i = 0; i < 10; i++) {
      recordClick(streamId, "category");
    }

    // Record 50 impressions for search, 5 clicks
    for (let i = 0; i < 50; i++) {
      recordImpression(streamId, "search");
    }
    for (let i = 0; i < 5; i++) {
      recordClick(streamId, "search");
    }

    const stats = getStreamStats(streamId);
    expect(stats.impressions).toBe(200);
    expect(stats.clicks).toBe(25);
    expect(stats.ctr_percent).toBe(12.5);

    expect(stats.by_source.explore.impressions).toBe(100);
    expect(stats.by_source.explore.clicks).toBe(10);
    expect(stats.by_source.explore.ctr_percent).toBe(10);

    expect(stats.by_source.category.impressions).toBe(50);
    expect(stats.by_source.category.clicks).toBe(10);
    expect(stats.by_source.category.ctr_percent).toBe(20);

    expect(stats.by_source.search.impressions).toBe(50);
    expect(stats.by_source.search.clicks).toBe(5);
    expect(stats.by_source.search.ctr_percent).toBe(10);
  });

  it("handles GET /api/routes-f/stream-card-impression?stream_id=...", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/routes-f/stream-card-impression?stream_id=${streamId}`
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stream_id).toBe(streamId);
    expect(data.impressions).toBe(200);
    expect(data.clicks).toBe(25);
  });

  it("handles POST /impression and POST /click endpoint calls", async () => {
    const testId = "stream-api-test-1";
    const reqImp = new NextRequest(
      "http://localhost:3000/api/routes-f/stream-card-impression/impression",
      {
        method: "POST",
        body: JSON.stringify({ stream_id: testId, source: "explore" }),
      }
    );
    const resImp = await POST(reqImp);
    expect(resImp.status).toBe(200);

    const reqClick = new NextRequest(
      "http://localhost:3000/api/routes-f/stream-card-impression/click",
      {
        method: "POST",
        body: JSON.stringify({
          stream_id: testId,
          source: "explore",
          action: "click",
        }),
      }
    );
    const resClick = await POST(reqClick);
    expect(resClick.status).toBe(200);

    const getReq = new NextRequest(
      `http://localhost:3000/api/routes-f/stream-card-impression?stream_id=${testId}`
    );
    const getRes = await GET(getReq);
    const data = await getRes.json();
    expect(data.impressions).toBe(1);
    expect(data.clicks).toBe(1);
    expect(data.ctr_percent).toBe(100);
  });
});
