/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const BASE_URL = "http://localhost/api/routes-f/raid-suggestions";

function makeGet(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("GET /api/routes-f/raid-suggestions", () => {
  it("returns suggestions array", async () => {
    const res = await GET(makeGet({ from_creator_id: "c-001" }));
    expect(res.status).toBe(200);
    const { suggestions } = await res.json();
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it("excludes the requesting creator from suggestions", async () => {
    const res = await GET(makeGet({ from_creator_id: "c-001" }));
    const { suggestions } = await res.json();
    const ids = suggestions.map((s: { creator: { id: string } }) => s.creator.id);
    expect(ids).not.toContain("c-001");
  });

  it("excludes blocked creators", async () => {
    // c-003 has blocked c-010 (and vice versa)
    const res = await GET(makeGet({ from_creator_id: "c-003" }));
    const { suggestions } = await res.json();
    const ids = suggestions.map((s: { creator: { id: string } }) => s.creator.id);
    expect(ids).not.toContain("c-010");
  });

  it("respects the limit param", async () => {
    const res = await GET(makeGet({ from_creator_id: "c-001", limit: "2" }));
    const { suggestions } = await res.json();
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it("suggestions are ranked by shared_followers descending", async () => {
    const res = await GET(makeGet({ from_creator_id: "c-001" }));
    const { suggestions } = await res.json();
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].shared_followers).toBeGreaterThanOrEqual(
        suggestions[i].shared_followers
      );
    }
  });

  it("each suggestion has required shape", async () => {
    const res = await GET(makeGet({ from_creator_id: "c-001" }));
    const { suggestions } = await res.json();
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s).toHaveProperty("creator");
      expect(s).toHaveProperty("viewers_now");
      expect(s).toHaveProperty("shared_followers");
      expect(s).toHaveProperty("reason");
    }
  });

  it("400 — missing from_creator_id", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});
