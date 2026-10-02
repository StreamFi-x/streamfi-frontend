import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/viewer-engagement-decay");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Viewer Engagement Decay API", () => {
  it("reports creators the viewer used to interact with but no longer does", async () => {
    const res = await GET(makeReq({ viewer_id: "v001" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    const names = data.decayed_creators.map((c: { creator: string }) => c.creator);
    expect(names).toContain("StreamKing"); // 45-day gap, 24 interactions
    expect(names).toContain("NightOwlGamer"); // 75-day gap, 11 interactions
  });

  it("each entry has creator, last_interaction_at and days_since", async () => {
    const res = await GET(makeReq({ viewer_id: "v001" }));
    const data = await res.json();

    for (const entry of data.decayed_creators) {
      expect(typeof entry.creator).toBe("string");
      expect(new Date(entry.last_interaction_at).toString()).not.toBe("Invalid Date");
      expect(typeof entry.days_since).toBe("number");
      expect(entry.days_since).toBeGreaterThan(30);
    }
  });

  it("excludes creators with fewer than 3 past interactions", async () => {
    const res = await GET(makeReq({ viewer_id: "v001" }));
    const data = await res.json();

    const names = data.decayed_creators.map((c: { creator: string }) => c.creator);
    expect(names).not.toContain("TechTalkDaily"); // only 2 interactions despite big gap
  });

  it("includes a creator at exactly the 3-interaction threshold", async () => {
    const res = await GET(makeReq({ viewer_id: "v002" }));
    const data = await res.json();

    const names = data.decayed_creators.map((c: { creator: string }) => c.creator);
    expect(names).toContain("CookingWithAlex"); // exactly 3 interactions, 31-day gap
  });

  it("excludes creators the viewer still engages with (gap <= 30 days)", async () => {
    const resV1 = await GET(makeReq({ viewer_id: "v001" }));
    const dataV1 = await resV1.json();
    expect(dataV1.decayed_creators.map((c: { creator: string }) => c.creator)).not.toContain(
      "MusicVibes" // active 5 days ago
    );

    // Boundary: a gap of exactly 30 days is NOT decay — the rule is > 30.
    const resV2 = await GET(makeReq({ viewer_id: "v002" }));
    const dataV2 = await resV2.json();
    expect(dataV2.decayed_creators.map((c: { creator: string }) => c.creator)).not.toContain(
      "FitnessFirst"
    );
  });

  it("bounds the report by window_days (default 90)", async () => {
    const res = await GET(makeReq({ viewer_id: "v001" }));
    const data = await res.json();
    const names = data.decayed_creators.map((c: { creator: string }) => c.creator);
    // 200-day-old relationship is outside the default 90-day window.
    expect(names).not.toContain("ArtByNature");

    const wide = await GET(makeReq({ viewer_id: "v001", window_days: "365" }));
    const wideData = await wide.json();
    expect(wideData.decayed_creators.map((c: { creator: string }) => c.creator)).toContain(
      "ArtByNature"
    );
  });

  it("sorts by days_since descending (longest-quiet first)", async () => {
    const res = await GET(makeReq({ viewer_id: "v001", window_days: "365" }));
    const data = await res.json();

    for (let i = 1; i < data.decayed_creators.length; i++) {
      expect(data.decayed_creators[i - 1].days_since).toBeGreaterThanOrEqual(
        data.decayed_creators[i].days_since
      );
    }
  });

  it("returns an empty report for an unknown viewer", async () => {
    const res = await GET(makeReq({ viewer_id: "v999" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.decayed_creators).toEqual([]);
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("falls back to the default window for invalid window_days", async () => {
    const res = await GET(makeReq({ viewer_id: "v001", window_days: "garbage" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Default 90-day window still excludes the 200-day-old relationship.
    expect(data.decayed_creators.map((c: { creator: string }) => c.creator)).not.toContain(
      "ArtByNature"
    );
  });
});
