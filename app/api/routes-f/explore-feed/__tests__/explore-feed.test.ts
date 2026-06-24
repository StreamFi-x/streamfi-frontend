/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const BASE_URL = "http://localhost/api/routes-f/explore-feed";

function makeGet(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("GET /api/routes-f/explore-feed", () => {
  it("returns four sections with correct titles", async () => {
    const res = await GET(makeGet({ viewer_id: "v-rich-001" }));
    expect(res.status).toBe(200);
    const { sections } = await res.json();
    const titles = sections.map((s: { title: string }) => s.title);
    expect(titles).toEqual([
      "For You",
      "Continue Watching",
      "Clips You Might Like",
      "New Creators",
    ]);
  });

  it("viewer with rich history gets personalised For You results", async () => {
    const res = await GET(makeGet({ viewer_id: "v-rich-001" }));
    const { sections } = await res.json();
    const forYou = sections.find((s: { title: string }) => s.title === "For You");
    expect(forYou.items.length).toBeGreaterThan(0);
    // Rich viewer follows c-001, c-002, c-003 — at least one should appear first
    const firstCreatorId = forYou.items[0].creator_id;
    expect(["c-001", "c-002", "c-003"]).toContain(firstCreatorId);
  });

  it("viewer with rich history gets Continue Watching with progress", async () => {
    const res = await GET(makeGet({ viewer_id: "v-rich-001" }));
    const { sections } = await res.json();
    const cont = sections.find((s: { title: string }) => s.title === "Continue Watching");
    expect(cont.items.length).toBeGreaterThan(0);
    for (const item of cont.items) {
      expect(typeof item.progress_pct).toBe("number");
    }
  });

  it("cold-start viewer gets empty Continue Watching", async () => {
    const res = await GET(makeGet({ viewer_id: "v-cold-new" }));
    const { sections } = await res.json();
    const cont = sections.find((s: { title: string }) => s.title === "Continue Watching");
    expect(cont.items).toHaveLength(0);
  });

  it("cold-start viewer still gets For You, Clips, and New Creators populated", async () => {
    const res = await GET(makeGet({ viewer_id: "v-cold-new" }));
    const { sections } = await res.json();
    const forYou = sections.find((s: { title: string }) => s.title === "For You");
    const clips = sections.find((s: { title: string }) => s.title === "Clips You Might Like");
    const newCreators = sections.find((s: { title: string }) => s.title === "New Creators");
    expect(forYou.items.length).toBeGreaterThan(0);
    expect(clips.items.length).toBeGreaterThan(0);
    expect(newCreators.items.length).toBeGreaterThan(0);
  });

  it("400 — missing viewer_id", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});
