import { NextRequest } from "next/server";
import { GET } from "../route";

function makeGet(params: Record<string, string>): NextRequest {
  const search = new URLSearchParams(params).toString();
  return new NextRequest(
    `http://localhost/api/routes-f/clip-transcript-search?${search}`
  );
}

describe("GET /api/routes-f/clip-transcript-search", () => {
  it("returns 400 when q is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });

  it("matches case-insensitively across multiple clips", async () => {
    const res = await GET(makeGet({ q: "stellar" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(3);
    expect(body.results.map((r: { clip: string }) => r.clip)).toEqual([
      "clip_stellar_intro",
      "clip_stellar_deep_dive",
      "clip_stellar_qa",
    ]);
  });

  it("includes a snippet and ts for each match", async () => {
    const res = await GET(makeGet({ q: "clutch play" }));
    const body = await res.json();
    expect(body.results).toEqual([
      {
        clip: "clip_gaming_moment",
        snippet: expect.stringContaining("clutch play"),
        ts: 15,
      },
    ]);
  });

  it("returns an empty result set when nothing matches", async () => {
    const res = await GET(makeGet({ q: "nonexistent phrase xyz" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it("filters by creator_id", async () => {
    const res = await GET(makeGet({ q: "stellar", creator_id: "creator_bob" }));
    const body = await res.json();
    expect(body.results).toEqual([
      expect.objectContaining({ clip: "clip_stellar_qa" }),
    ]);
  });

  it("respects the limit parameter", async () => {
    const res = await GET(makeGet({ q: "stellar", limit: "1" }));
    const body = await res.json();
    expect(body.results).toHaveLength(1);
  });

  it("returns 400 for a non-positive limit", async () => {
    const res = await GET(makeGet({ q: "stellar", limit: "0" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-integer limit", async () => {
    const res = await GET(makeGet({ q: "stellar", limit: "abc" }));
    expect(res.status).toBe(400);
  });
});
