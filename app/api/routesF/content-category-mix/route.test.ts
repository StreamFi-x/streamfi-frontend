import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/content-category-mix");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("Content Category Mix API", () => {
  it("returns category mix for a creator", async () => {
    const res = await GET(makeReq({ creator_id: "creator123" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.categories).toBeDefined();
    expect(data.categories.length).toBeGreaterThan(0);

    for (const cat of data.categories) {
      expect(cat).toHaveProperty("category");
      expect(cat).toHaveProperty("streams");
      expect(cat).toHaveProperty("total_hours");
      expect(cat).toHaveProperty("percent");
      expect(cat.streams).toBeGreaterThan(0);
      expect(cat.total_hours).toBeGreaterThan(0);
      expect(cat.percent).toBeGreaterThan(0);
    }
  });

  it("verifies percentages sum to 100", async () => {
    const res = await GET(makeReq({ creator_id: "testcreator" }));
    const data = await res.json();

    const totalPercent = data.categories.reduce((sum: number, cat: any) => sum + cat.percent, 0);
    expect(totalPercent).toBeCloseTo(100, 1);
  });

  it("returns different data for different creators", async () => {
    const res1 = await GET(makeReq({ creator_id: "creator1" }));
    const res2 = await GET(makeReq({ creator_id: "creator2" }));

    const data1 = await res1.json();
    const data2 = await res2.json();

    const hoursMatch = data1.categories.every((c: any, i: number) => c.total_hours === data2.categories[i].total_hours);
    expect(hoursMatch).toBe(false);
  });

  it("includes multiple categories", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    expect(data.categories.length).toBeGreaterThanOrEqual(3);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is empty", async () => {
    const res = await GET(makeReq({ creator_id: "" }));
    expect(res.status).toBe(400);
  });

  it("computes stream count based on hours", async () => {
    const res = await GET(makeReq({ creator_id: "consistent" }));
    const data = await res.json();

    for (const cat of data.categories) {
      expect(cat.streams).toBeGreaterThan(0);
      expect(cat.streams).toBeLessThanOrEqual(cat.total_hours);
    }
  });
});
