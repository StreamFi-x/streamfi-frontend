/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { aggregateByCategory } from "../aggregate";
import { streamsForCreator } from "../seed";
import type { CategoryPerformance } from "../types";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/category-performance${query}`
  );
}

describe("aggregateByCategory", () => {
  const streams = streamsForCreator("creator_a");

  it("counts streams per category", () => {
    const result = aggregateByCategory(streams);
    const gaming = result.find(c => c.category === "gaming")!;
    expect(gaming.stream_count).toBe(3);
  });

  it("computes average viewers per stream", () => {
    // gaming: (100+200+300)/3 = 200.
    const result = aggregateByCategory(streams);
    const gaming = result.find(c => c.category === "gaming")!;
    expect(gaming.avg_viewers).toBe(200);
  });

  it("computes average tips per stream", () => {
    // gaming: (20+40+30)/3 = 30.
    const result = aggregateByCategory(streams);
    const gaming = result.find(c => c.category === "gaming")!;
    expect(gaming.avg_tips_usdc).toBe(30);
  });

  it("rounds non-integer averages to 2 decimals", () => {
    // esports: viewers (500+700)/2 = 600, tips (100+150)/2 = 125.
    const result = aggregateByCategory(streams);
    const esports = result.find(c => c.category === "esports")!;
    expect(esports.avg_viewers).toBe(600);
    expect(esports.avg_tips_usdc).toBe(125);
  });

  it("sorts by stream_count descending", () => {
    const result = aggregateByCategory(streams);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].stream_count).toBeGreaterThanOrEqual(
        result[i].stream_count
      );
    }
    // gaming (3) should come before esports (2) and irl (1).
    expect(result[0].category).toBe("gaming");
  });

  it("handles a single-stream category", () => {
    const result = aggregateByCategory(streams);
    const irl = result.find(c => c.category === "irl")!;
    expect(irl.stream_count).toBe(1);
    expect(irl.avg_viewers).toBe(80);
    expect(irl.avg_tips_usdc).toBe(5);
  });

  it("returns an empty array for no streams", () => {
    expect(aggregateByCategory([])).toEqual<CategoryPerformance[]>([]);
  });
});

describe("GET /api/routes-f/category-performance", () => {
  it("requires creator_id", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("creator_id");
  });

  it("returns per-category performance sorted by stream_count", async () => {
    const res = await GET(makeReq("?creator_id=creator_a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categories[0].category).toBe("gaming");
    expect(body.categories[0].stream_count).toBe(3);
  });

  it("only includes the requested creator's streams", async () => {
    const res = await GET(makeReq("?creator_id=creator_b"));
    const body = await res.json();
    expect(body.categories).toHaveLength(1);
    expect(body.categories[0].category).toBe("music");
    // music: viewers (60+90)/2 = 75, tips (12+18)/2 = 15.
    expect(body.categories[0].avg_viewers).toBe(75);
    expect(body.categories[0].avg_tips_usdc).toBe(15);
  });

  it("returns an empty list for an unknown creator", async () => {
    const res = await GET(makeReq("?creator_id=ghost"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categories).toEqual([]);
  });
});
