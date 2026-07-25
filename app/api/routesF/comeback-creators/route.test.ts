import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/comeback-creators");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Comeback Creators API", () => {
  it("returns a list of creators with required fields", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.creators)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(data.creators.length).toBe(data.total);
  });

  it("each creator has required fields", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    for (const creator of data.creators) {
      expect(creator).toHaveProperty("creator_id");
      expect(creator).toHaveProperty("username");
      expect(creator).toHaveProperty("gap_days");
      expect(creator).toHaveProperty("last_inactive_date");
      expect(creator).toHaveProperty("return_date");
      expect(creator).toHaveProperty("streams_since_return");
    }
  });

  it("filters creators by min_gap_days", async () => {
    const res = await GET(makeReq({ min_gap_days: "60" }));
    const data = await res.json();

    for (const creator of data.creators) {
      expect(creator.gap_days).toBeGreaterThanOrEqual(60);
    }
  });

  it("respects limit parameter", async () => {
    const res = await GET(makeReq({ limit: "3" }));
    const data = await res.json();

    expect(data.creators.length).toBeLessThanOrEqual(3);
  });

  it("returns creators sorted by gap_days descending", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    for (let i = 1; i < data.creators.length; i++) {
      expect(data.creators[i - 1].gap_days).toBeGreaterThanOrEqual(data.creators[i].gap_days);
    }
  });

  it("returns empty list when min_gap_days exceeds all creators", async () => {
    const res = await GET(makeReq({ min_gap_days: "999" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.creators).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("clamps limit to 100", async () => {
    const res = await GET(makeReq({ limit: "9999" }));
    const data = await res.json();

    expect(data.creators.length).toBeLessThanOrEqual(100);
  });

  it("uses default min_gap_days of 30 when omitted", async () => {
    const resDefault = await GET(makeReq());
    const resExplicit = await GET(makeReq({ min_gap_days: "30" }));

    const dataDefault = await resDefault.json();
    const dataExplicit = await resExplicit.json();

    expect(dataDefault.total).toBe(dataExplicit.total);
  });
});
