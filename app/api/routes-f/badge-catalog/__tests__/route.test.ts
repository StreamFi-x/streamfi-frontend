/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(creatorId?: string): NextRequest {
  const url = creatorId
    ? `http://localhost/api/routes-f/badge-catalog?creator_id=${creatorId}`
    : "http://localhost/api/routes-f/badge-catalog";
  return new NextRequest(url);
}

describe("GET /api/routes-f/badge-catalog", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("creator_id");
  });

  it("returns 400 when creator_id is blank", async () => {
    const res = await GET(makeReq("   "));
    expect(res.status).toBe(400);
  });

  it("returns the badge catalog for a known creator", async () => {
    const res = await GET(makeReq("creator_a"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.creator_id).toBe("creator_a");
    expect(body.badges).toHaveLength(3);
    expect(body.badges.map((b: { badge_id: string }) => b.badge_id)).toEqual([
      "badge_founder",
      "badge_1yr",
      "badge_mod",
    ]);
  });

  it("includes image_url and unlock_rule on each badge", async () => {
    const res = await GET(makeReq("creator_b"));
    const body = await res.json();

    expect(body.badges[0]).toEqual({
      badge_id: "badge_vip",
      name: "VIP",
      image_url: expect.any(String),
      unlock_rule: expect.any(String),
    });
  });

  it("returns an empty array for a creator with no badges defined", async () => {
    const res = await GET(makeReq("creator_c"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badges).toEqual([]);
  });

  it("returns an empty array for an unknown creator_id", async () => {
    const res = await GET(makeReq("creator_does_not_exist"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badges).toEqual([]);
  });
});
