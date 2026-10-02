import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/creator-badge-showcase");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Creator Badge Showcase API", () => {
  it("returns the badges a creator has earned", async () => {
    const res = await GET(makeReq({ creator_id: "c001" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.badges)).toBe(true);
    expect(data.badges.length).toBe(4);
  });

  it("each badge has slug, name and earned_at", async () => {
    const res = await GET(makeReq({ creator_id: "c001" }));
    const data = await res.json();

    for (const badge of data.badges) {
      expect(typeof badge.slug).toBe("string");
      expect(typeof badge.name).toBe("string");
      expect(new Date(badge.earned_at).toString()).not.toBe("Invalid Date");
    }
  });

  it("sorts badges by earned_at descending (newest first)", async () => {
    const res = await GET(makeReq({ creator_id: "c001" }));
    const data = await res.json();

    for (let i = 1; i < data.badges.length; i++) {
      const prev = new Date(data.badges[i - 1].earned_at).getTime();
      const curr = new Date(data.badges[i].earned_at).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
    // Concrete ordering for c001: tip-magnet (May) first, first-stream (Jan) last.
    expect(data.badges[0].slug).toBe("tip-magnet");
    expect(data.badges[data.badges.length - 1].slug).toBe("first-stream");
  });

  it("sorting holds for every seeded creator", async () => {
    for (const creatorId of ["c001", "c002", "c003"]) {
      const res = await GET(makeReq({ creator_id: creatorId }));
      const data = await res.json();

      for (let i = 1; i < data.badges.length; i++) {
        expect(new Date(data.badges[i - 1].earned_at).getTime()).toBeGreaterThanOrEqual(
          new Date(data.badges[i].earned_at).getTime()
        );
      }
    }
  });

  it("returns an empty list for a creator with no badges", async () => {
    const res = await GET(makeReq({ creator_id: "c999" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.badges).toEqual([]);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
