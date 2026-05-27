/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../text-similarity/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/text-similarity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/text-similarity", () => {
  it("returns 1 for identical text on both Jaccard and cosine", async () => {
    const res = await POST(makeReq({ a: "The quick brown fox", b: "The quick brown fox" }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.jaccard).toBe(1);
    expect(data.cosine).toBe(1);
  });

  it("returns 0 for completely disjoint text", async () => {
    const res = await POST(makeReq({ a: "apple orange", b: "cat dog" }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.jaccard).toBe(0);
    expect(data.cosine).toBe(0);
  });

  it("computes partial overlap using both algorithms", async () => {
    const res = await POST(
      makeReq({ a: "quick brown fox", b: "brown fox jumps", algorithm: "both" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.jaccard).toBe(0.5);
    expect(data.cosine).toBeCloseTo(0.6667, 3);
  });

  it("supports single-algorithm selection", async () => {
    const res = await POST(makeReq({ a: "a b c", b: "a b", algorithm: "jaccard" }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toEqual({ jaccard: 0.6666666666666666 });
  });
});
