import { NextRequest } from "next/server";
import { GET } from "../route";
import { generateLedger } from "../seedData";
import { sortByCreatedAtDesc } from "../utils";

function makeGet(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/routes-f/channel-points-history");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routes-f/channel-points-history", () => {
  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeGet({ creator_id: "creator_a" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer_a" }));
    expect(res.status).toBe(400);
  });

  it("returns a ledger scoped to the requested viewer and creator", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer_1", creator_id: "creator_1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewer_id).toBe("viewer_1");
    expect(body.creator_id).toBe("creator_1");
    expect(Array.isArray(body.ledger)).toBe(true);
    expect(body.ledger.length).toBeGreaterThan(0);
    for (const entry of body.ledger) {
      expect(entry.viewer_id).toBe("viewer_1");
      expect(entry.creator_id).toBe("creator_1");
      expect(["earn", "redemption"]).toContain(entry.type);
    }
  });

  it("sorts the ledger by created_at descending", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer_2", creator_id: "creator_2" }));
    const body = await res.json();
    for (let i = 1; i < body.ledger.length; i++) {
      expect(body.ledger[i - 1].created_at >= body.ledger[i].created_at).toBe(true);
    }
  });

  it("respects the limit query param", async () => {
    const res = await GET(
      makeGet({ viewer_id: "viewer_3", creator_id: "creator_3", limit: "2" })
    );
    const body = await res.json();
    expect(body.ledger.length).toBeLessThanOrEqual(2);
  });

  it("returns 400 for an out-of-range limit", async () => {
    const res = await GET(
      makeGet({ viewer_id: "viewer_4", creator_id: "creator_4", limit: "0" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-numeric limit", async () => {
    const res = await GET(
      makeGet({ viewer_id: "viewer_4", creator_id: "creator_4", limit: "abc" })
    );
    expect(res.status).toBe(400);
  });

  it("is deterministic for the same viewer/creator pair", async () => {
    const res1 = await GET(makeGet({ viewer_id: "viewer_stable", creator_id: "creator_stable" }));
    const res2 = await GET(makeGet({ viewer_id: "viewer_stable", creator_id: "creator_stable" }));
    expect(await res1.json()).toEqual(await res2.json());
  });

  it("returns different ledgers for different creators of the same viewer", async () => {
    const res1 = await GET(makeGet({ viewer_id: "viewer_x", creator_id: "creator_x" }));
    const res2 = await GET(makeGet({ viewer_id: "viewer_x", creator_id: "creator_y" }));
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.ledger).not.toEqual(body2.ledger);
  });

  describe("seedData: generateLedger", () => {
    it("never lets balance_after go negative", () => {
      const ledger = generateLedger("viewer_neg", "creator_neg");
      for (const entry of ledger) {
        expect(entry.balance_after).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("utils: sortByCreatedAtDesc", () => {
    it("does not mutate the input array", () => {
      const input = generateLedger("viewer_immut", "creator_immut");
      const originalOrder = input.map(e => e.entry_id);
      sortByCreatedAtDesc(input);
      expect(input.map(e => e.entry_id)).toEqual(originalOrder);
    });

    it("handles an empty array", () => {
      expect(sortByCreatedAtDesc([])).toEqual([]);
    });
  });
});
