/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const BASE_URL = "http://localhost/api/routes-f/explore";

function makeGetReq(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

const SECTION_TITLES = [
  "For You",
  "Continue Watching",
  "Clips You Might Like",
  "New Creators",
];

describe("GET /api/routes-f/explore", () => {
  it("returns all 4 sections for a viewer with rich history", async () => {
    const res = await GET(makeGetReq({ viewer_id: "viewer-power" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sections)).toBe(true);
    const titles = body.sections.map((s: { title: string }) => s.title);
    for (const expected of SECTION_TITLES) {
      expect(titles).toContain(expected);
    }
  });

  it("for a viewer with rich history, For You is personalised by tag overlap", async () => {
    const res = await GET(makeGetReq({ viewer_id: "viewer-power" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const forYou = body.sections.find(
      (s: { title: string }) => s.title === "For You"
    );
    expect(forYou).toBeDefined();
    expect(Array.isArray(forYou.items)).toBe(true);
    // viewer-power watches gaming, fps, coding — should include gaming/fps/coding streams first
    const firstItemTags: string[] = forYou.items[0]?.tags ?? [];
    const hasFit = firstItemTags.some((t: string) =>
      ["gaming", "fps", "coding"].includes(t)
    );
    expect(hasFit).toBe(true);
  });

  it("returns all 4 sections for a cold-start viewer", async () => {
    const res = await GET(makeGetReq({ viewer_id: "viewer-brand-new" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const titles = body.sections.map((s: { title: string }) => s.title);
    for (const expected of SECTION_TITLES) {
      expect(titles).toContain(expected);
    }
  });

  it("cold-start viewer For You section returns top streams by viewers_now", async () => {
    const res = await GET(makeGetReq({ viewer_id: "viewer-cold" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const forYou = body.sections.find(
      (s: { title: string }) => s.title === "For You"
    );
    expect(forYou).toBeDefined();
    expect(Array.isArray(forYou.items)).toBe(true);
    // Should be sorted by viewers_now descending for cold start
    const viewerCounts: number[] = forYou.items.map(
      (i: { viewers_now: number }) => i.viewers_now
    );
    for (let i = 1; i < viewerCounts.length; i++) {
      expect(viewerCounts[i - 1]).toBeGreaterThanOrEqual(viewerCounts[i]);
    }
  });

  it("400 — missing viewer_id", async () => {
    const res = await GET(makeGetReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
