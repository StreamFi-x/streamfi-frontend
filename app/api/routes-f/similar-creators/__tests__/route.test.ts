/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { jaccard, rankSimilarCreators } from "../similarity";
import { creatorGraph, getCreator } from "../seed";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/similar-creators${query}`
  );
}

describe("jaccard", () => {
  it("returns 1 for identical sets", () => {
    expect(jaccard(["a", "b"], ["b", "a"])).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccard(["a"], ["b"])).toBe(0);
  });

  it("returns 0 for two empty sets", () => {
    expect(jaccard([], [])).toBe(0);
  });

  it("computes partial overlap correctly", () => {
    // {a,b,c} vs {b,c,d}: intersection 2, union 4 => 0.5
    expect(jaccard(["a", "b", "c"], ["b", "c", "d"])).toBe(0.5);
  });

  it("is order-independent and de-duplicates", () => {
    expect(jaccard(["a", "a", "b"], ["b", "a"])).toBe(1);
  });
});

describe("rankSimilarCreators", () => {
  const target = getCreator("creator_a")!;

  it("never includes the target creator itself", () => {
    const ranked = rankSimilarCreators(target, creatorGraph, 10);
    expect(ranked.find(r => r.creator.creator_id === "creator_a")).toBeUndefined();
  });

  it("drops creators with zero similarity", () => {
    const ranked = rankSimilarCreators(target, creatorGraph, 10);
    // creator_e (art/irl, followers v20/v21) shares nothing with creator_a.
    expect(ranked.find(r => r.creator.creator_id === "creator_e")).toBeUndefined();
  });

  it("sorts by similarity_score descending", () => {
    const ranked = rankSimilarCreators(target, creatorGraph, 10);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].similarity_score).toBeGreaterThanOrEqual(
        ranked[i].similarity_score
      );
    }
  });

  it("scores equal the sum of category and follower jaccard", () => {
    const ranked = rankSimilarCreators(target, creatorGraph, 10);
    const b = ranked.find(r => r.creator.creator_id === "creator_b")!;
    // categories: {gaming,esports} vs {gaming,esports,irl} => 2/3
    // followers: {v1..v6} vs {v1,v2,v3,v7,v8} => 3/8
    const expected = Number((2 / 3 + 3 / 8).toFixed(4));
    expect(b.similarity_score).toBe(expected);
  });

  it("respects the limit", () => {
    const ranked = rankSimilarCreators(target, creatorGraph, 2);
    expect(ranked.length).toBeLessThanOrEqual(2);
  });
});

describe("GET /api/routes-f/similar-creators", () => {
  describe("Validation", () => {
    it("requires creator_id", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("creator_id");
    });

    it("404s for unknown creator", async () => {
      const res = await GET(makeReq("?creator_id=nope"));
      expect(res.status).toBe(404);
    });

    it("rejects a non-integer limit", async () => {
      const res = await GET(makeReq("?creator_id=creator_a&limit=2.5"));
      expect(res.status).toBe(400);
    });

    it("rejects limit below 1", async () => {
      const res = await GET(makeReq("?creator_id=creator_a&limit=0"));
      expect(res.status).toBe(400);
    });

    it("rejects limit above the maximum", async () => {
      const res = await GET(makeReq("?creator_id=creator_a&limit=999"));
      expect(res.status).toBe(400);
    });
  });

  describe("Overlap shapes", () => {
    it("returns creators ranked by similarity", async () => {
      const res = await GET(makeReq("?creator_id=creator_a"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.creators)).toBe(true);
      expect(body.creators.length).toBeGreaterThan(0);
    });

    it("each result has creator, similarity_score and reason", async () => {
      const res = await GET(makeReq("?creator_id=creator_a"));
      const body = await res.json();
      body.creators.forEach(
        (c: {
          creator: { creator_id: string; name: string; categories: string[] };
          similarity_score: number;
          reason: string;
        }) => {
          expect(c.creator).toHaveProperty("creator_id");
          expect(c.creator).toHaveProperty("name");
          expect(c.creator).toHaveProperty("categories");
          expect(typeof c.similarity_score).toBe("number");
          expect(typeof c.reason).toBe("string");
        }
      );
    });

    it("does not leak follower sets in the response", async () => {
      const res = await GET(makeReq("?creator_id=creator_a"));
      const body = await res.json();
      body.creators.forEach((c: { creator: Record<string, unknown> }) => {
        expect(c.creator).not.toHaveProperty("followers");
      });
    });

    it("the reason names the shared categories and mutual followers", async () => {
      const res = await GET(makeReq("?creator_id=creator_a"));
      const body = await res.json();
      const b = body.creators.find(
        (c: { creator: { creator_id: string } }) =>
          c.creator.creator_id === "creator_b"
      );
      expect(b.reason).toContain("categories");
      expect(b.reason).toContain("gaming");
      expect(b.reason).toContain("mutual");
    });

    it("category-only overlap still yields a positive score", async () => {
      // creator_g shares categories with creator_d (education) only.
      const res = await GET(makeReq("?creator_id=creator_d"));
      const body = await res.json();
      const g = body.creators.find(
        (c: { creator: { creator_id: string } }) =>
          c.creator.creator_id === "creator_g"
      );
      expect(g).toBeDefined();
      expect(g.similarity_score).toBeGreaterThan(0);
    });

    it("follower-only overlap still yields a positive score", async () => {
      // creator_f and creator_e share follower v21 and category irl.
      const res = await GET(makeReq("?creator_id=creator_e"));
      const body = await res.json();
      const f = body.creators.find(
        (c: { creator: { creator_id: string } }) =>
          c.creator.creator_id === "creator_f"
      );
      expect(f).toBeDefined();
      expect(f.similarity_score).toBeGreaterThan(0);
    });

    it("respects the limit query param", async () => {
      const res = await GET(makeReq("?creator_id=creator_a&limit=1"));
      const body = await res.json();
      expect(body.creators.length).toBeLessThanOrEqual(1);
    });

    it("returns deterministic results across calls", async () => {
      const a = await (await GET(makeReq("?creator_id=creator_a"))).json();
      const b = await (await GET(makeReq("?creator_id=creator_a"))).json();
      expect(a.creators).toEqual(b.creators);
    });
  });
});
