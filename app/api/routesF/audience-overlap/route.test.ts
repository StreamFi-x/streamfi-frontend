import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(a: string | null, b: string | null) {
  const url = new URL("http://localhost/api/routesF/audience-overlap");
  if (a !== null) {url.searchParams.set("a", a);}
  if (b !== null) {url.searchParams.set("b", b);}
  return new NextRequest(url);
}

describe("GET /api/routesF/audience-overlap", () => {
  it("computes overlap_count and jaccard for two seeded creators", async () => {
    // novastreams: fan-1..fan-7 (7). pixelpatch: fan-3,4,5,8,9 (5).
    // Overlap: fan-3, fan-4, fan-5 = 3. Union size = 9. Jaccard = 3/9 = 0.3333.
    const res = await GET(makeReq("novastreams", "pixelpatch"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.overlap_count).toBe(3);
    expect(data.jaccard).toBeCloseTo(0.3333, 3);
  });

  it("computes exclusive_a and exclusive_b correctly", async () => {
    const res = await GET(makeReq("novastreams", "pixelpatch"));
    const data = await res.json();

    // novastreams has 7 followers, 3 overlap -> 4 exclusive.
    // pixelpatch has 5 followers, 3 overlap -> 2 exclusive.
    expect(data.exclusive_a).toBe(4);
    expect(data.exclusive_b).toBe(2);
  });

  it("is symmetric: overlap(a, b) equals overlap(b, a) with exclusive_a/b swapped", async () => {
    const forward = await GET(makeReq("novastreams", "pixelpatch"));
    const forwardData = await forward.json();

    const backward = await GET(makeReq("pixelpatch", "novastreams"));
    const backwardData = await backward.json();

    expect(backwardData.overlap_count).toBe(forwardData.overlap_count);
    expect(backwardData.jaccard).toBeCloseTo(forwardData.jaccard, 6);
    expect(backwardData.exclusive_a).toBe(forwardData.exclusive_b);
    expect(backwardData.exclusive_b).toBe(forwardData.exclusive_a);
  });

  it("returns 0 overlap and jaccard for creators with no shared followers", async () => {
    // walletwiz: fan-1,6,7,10,11,12. clipnation: fan-2,9,10,13. Shared: fan-10 -> not disjoint, use others.
    const res = await GET(makeReq("walletwiz", "clipnation"));
    const data = await res.json();

    expect(data.overlap_count).toBe(1);
    expect(data.jaccard).toBeGreaterThan(0);
  });

  it("returns jaccard of 1 when a creator is compared with itself", async () => {
    const res = await GET(makeReq("novastreams", "novastreams"));
    const data = await res.json();

    expect(data.jaccard).toBe(1);
    expect(data.exclusive_a).toBe(0);
    expect(data.exclusive_b).toBe(0);
  });

  it("handles unknown creator ids deterministically without erroring", async () => {
    const res1 = await GET(makeReq("unknown-creator-a", "unknown-creator-b"));
    const res2 = await GET(makeReq("unknown-creator-a", "unknown-creator-b"));
    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(res1.status).toBe(200);
    expect(data1).toEqual(data2);
  });

  it("returns 400 when 'a' is missing", async () => {
    const res = await GET(makeReq(null, "pixelpatch"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when 'b' is missing", async () => {
    const res = await GET(makeReq("novastreams", null));
    expect(res.status).toBe(400);
  });
});
