/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { sortByEarnedAtDesc, toEarnedEntry } from "../utils";
import { earnedBadgeStore, getEarnedBadgesForViewer } from "../seedData";

function makeReq(viewerId?: string): NextRequest {
  const url = viewerId
    ? `http://localhost/api/routes-f/badge-my-earned?viewer_id=${viewerId}`
    : "http://localhost/api/routes-f/badge-my-earned";
  return new NextRequest(url);
}

describe("GET /api/routes-f/badge-my-earned", () => {
  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("viewer_id");
  });

  it("returns 400 when viewer_id is blank", async () => {
    const res = await GET(makeReq("   "));
    expect(res.status).toBe(400);
  });

  it("returns all badges earned by the viewer, across channels, newest first", async () => {
    const res = await GET(makeReq("viewer_1"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.badges).toHaveLength(2);
    expect(body.badges.map((b: { badge_id: string }) => b.badge_id)).toEqual([
      "badge_vip",
      "badge_founder",
    ]);
  });

  it("only returns badges belonging to the requested viewer", async () => {
    const res = await GET(makeReq("viewer_2"));
    const body = await res.json();

    expect(body.badges).toHaveLength(1);
    expect(body.badges[0].badge_id).toBe("badge_mod");
  });

  it("includes creator and image details on each entry", async () => {
    const res = await GET(makeReq("viewer_2"));
    const body = await res.json();

    expect(body.badges[0]).toEqual({
      badge_id: "badge_mod",
      creator_id: "creator_a",
      creator_name: "AlphaStreams",
      name: "Moderator",
      image_url: expect.any(String),
      earned_at: "2026-01-20T00:00:00.000Z",
    });
  });

  it("does not leak viewer_id on entries", async () => {
    const res = await GET(makeReq("viewer_1"));
    const body = await res.json();

    for (const badge of body.badges) {
      expect(badge).not.toHaveProperty("viewer_id");
    }
  });

  it("returns an empty array for a viewer with no earned badges", async () => {
    const res = await GET(makeReq("viewer_with_no_badges"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badges).toEqual([]);
  });

  describe("utils", () => {
    it("sortByEarnedAtDesc orders newest first", () => {
      const sorted = sortByEarnedAtDesc(getEarnedBadgesForViewer("viewer_1"));
      expect(sorted.map((b) => b.badge_id)).toEqual([
        "badge_vip",
        "badge_founder",
      ]);
    });

    it("toEarnedEntry strips viewer_id", () => {
      const entry = toEarnedEntry(earnedBadgeStore[0]);
      expect(entry).not.toHaveProperty("viewer_id");
    });
  });
});
