import { NextRequest } from "next/server";
import { GET } from "../route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/related-clips");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routes-f/related-clips", () => {
  it("returns related clips for a known clip_id", async () => {
    const res = await GET(makeGet({ clip_id: "clip-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.clip_id).toBe("clip-001");
    expect(Array.isArray(data.related)).toBe(true);
    expect(data.related.length).toBeGreaterThan(0);
  });

  it("does not include the queried clip in the results", async () => {
    const res = await GET(makeGet({ clip_id: "clip-001" }));
    const data = await res.json();
    const ids = data.related.map((r: { clip: { clip_id: string } }) => r.clip.clip_id);
    expect(ids).not.toContain("clip-001");
  });

  it("each result has clip and similarity_score fields", async () => {
    const res = await GET(makeGet({ clip_id: "clip-003" }));
    const data = await res.json();
    for (const item of data.related) {
      expect(item).toHaveProperty("clip");
      expect(typeof item.similarity_score).toBe("number");
      expect(item.similarity_score).toBeGreaterThanOrEqual(0);
      expect(item.similarity_score).toBeLessThanOrEqual(1);
    }
  });

  it("results are ranked by similarity_score descending", async () => {
    const res = await GET(makeGet({ clip_id: "clip-007" }));
    const data = await res.json();
    for (let i = 1; i < data.related.length; i++) {
      expect(data.related[i - 1].similarity_score).toBeGreaterThanOrEqual(
        data.related[i].similarity_score,
      );
    }
  });

  it("same-creator clips have higher scores than clips from different creators with same tags", async () => {
    const res = await GET(makeGet({ clip_id: "clip-001" }));
    const data = await res.json();
    const sameCreator = data.related.filter(
      (r: { clip: { creator_id: string } }) => r.clip.creator_id === "creator-alpha",
    );
    const diffCreator = data.related.filter(
      (r: { clip: { creator_id: string } }) => r.clip.creator_id !== "creator-alpha",
    );
    if (sameCreator.length > 0 && diffCreator.length > 0) {
      expect(sameCreator[0].similarity_score).toBeGreaterThanOrEqual(
        diffCreator[diffCreator.length - 1].similarity_score,
      );
    }
  });

  it("respects the limit query param", async () => {
    const res = await GET(makeGet({ clip_id: "clip-003", limit: "2" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.related.length).toBeLessThanOrEqual(2);
  });

  it("returns 400 when clip_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });

  it("returns empty related array for unknown clip_id", async () => {
    const res = await GET(makeGet({ clip_id: "clip-does-not-exist" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.related).toEqual([]);
  });
});
