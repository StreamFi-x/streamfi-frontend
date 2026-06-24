/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const BASE_URL = "http://localhost/api/routes-f/raid-suggestions";

function makeGetReq(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("GET /api/routes-f/raid-suggestions", () => {
  it("returns suggestions ranked by shared_followers descending", async () => {
    const res = await GET(
      makeGetReq({ from_creator_id: "creator-beta" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.suggestions)).toBe(true);
    // All results should be live
    for (const s of body.suggestions) {
      expect(s).toHaveProperty("creator_id");
      expect(s).toHaveProperty("viewers_now");
      expect(s).toHaveProperty("shared_followers");
      expect(s).toHaveProperty("reason");
    }
    // Ranked descending
    const followers = body.suggestions.map(
      (s: { shared_followers: number }) => s.shared_followers
    );
    for (let i = 1; i < followers.length; i++) {
      expect(followers[i - 1]).toBeGreaterThanOrEqual(followers[i]);
    }
  });

  it("excludes the requesting creator from suggestions (self-exclusion)", async () => {
    const res = await GET(
      makeGetReq({ from_creator_id: "creator-alpha" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.suggestions.map(
      (s: { creator_id: string }) => s.creator_id
    );
    expect(ids).not.toContain("creator-alpha");
  });

  it("excludes non-live creators", async () => {
    const res = await GET(
      makeGetReq({ from_creator_id: "creator-alpha" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // creator-gamma and creator-zeta are not live in seed
    const ids = body.suggestions.map(
      (s: { creator_id: string }) => s.creator_id
    );
    expect(ids).not.toContain("creator-gamma");
    expect(ids).not.toContain("creator-zeta");
  });

  it("respects the limit parameter", async () => {
    const res = await GET(
      makeGetReq({ from_creator_id: "creator-beta", limit: "2" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions.length).toBeLessThanOrEqual(2);
  });

  it("defaults to limit 5", async () => {
    const res = await GET(
      makeGetReq({ from_creator_id: "creator-beta" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions.length).toBeLessThanOrEqual(5);
  });

  it("400 — missing from_creator_id", async () => {
    const res = await GET(makeGetReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
