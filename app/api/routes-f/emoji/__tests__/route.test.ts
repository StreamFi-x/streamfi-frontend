import { GET } from "../route";
import { NextRequest } from "next/server";

function makeReq(url: string) {
  return new NextRequest(url);
}

describe("GET /api/routes-f/emoji", () => {
  it("returns results with no filters", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
  });

  it("defaults limit to 20", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji"));
    const body = await res.json();
    expect(body.results.length).toBeLessThanOrEqual(20);
  });

  it("filters by category", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji?category=food"));
    const body = await res.json();
    body.results.forEach((r: { category: string }) => {
      expect(r.category).toBe("food");
    });
  });

  it("searches by keyword", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji?q=fire"));
    const body = await res.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].shortcode).toBe("fire");
  });

  it("exact name match ranks first", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji?q=pizza"));
    const body = await res.json();
    expect(body.results[0].shortcode).toBe("pizza");
  });

  it("respects limit param", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji?limit=5"));
    const body = await res.json();
    expect(body.results.length).toBeLessThanOrEqual(5);
  });

  it("caps limit at 100", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji?limit=999"));
    const body = await res.json();
    expect(body.results.length).toBeLessThanOrEqual(100);
  });

  it("returns 400 for invalid category", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji?category=invalid"));
    expect(res.status).toBe(400);
  });

  it("result has expected shape", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/emoji?q=star"));
    const body = await res.json();
    const item = body.results[0];
    expect(item).toHaveProperty("char");
    expect(item).toHaveProperty("name");
    expect(item).toHaveProperty("shortcode");
    expect(item).toHaveProperty("category");
    expect(item).toHaveProperty("keywords");
  });
});
