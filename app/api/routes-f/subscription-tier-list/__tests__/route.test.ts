/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { toListEntry } from "../utils";
import { getActiveTiersForCreator, subscriptionTierStore } from "../seedData";

function makeReq(creatorId?: string): NextRequest {
  const url = creatorId
    ? `http://localhost/api/routes-f/subscription-tier-list?creator_id=${creatorId}`
    : "http://localhost/api/routes-f/subscription-tier-list";
  return new NextRequest(url);
}

describe("GET /api/routes-f/subscription-tier-list", () => {
  describe("Required Parameters", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("creator_id");
    });
  });

  describe("Active tiers", () => {
    it("returns only active tiers for creator-alpha", async () => {
      const res = await GET(makeReq("creator-alpha"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.tiers).toHaveLength(2);
      const ids = body.tiers.map((t: { tier_id: string }) => t.tier_id);
      expect(ids).toEqual(["tier_alpha_basic", "tier_alpha_premium"]);
      expect(ids).not.toContain("tier_alpha_legacy");
    });

    it("includes price, benefits, and badge on each tier", async () => {
      const res = await GET(makeReq("creator-alpha"));
      const body = await res.json();

      const basic = body.tiers.find(
        (t: { tier_id: string }) => t.tier_id === "tier_alpha_basic"
      );
      expect(basic).toEqual({
        tier_id: "tier_alpha_basic",
        name: "Basic",
        price_usdc: 5,
        benefits: ["Ad-free viewing", "Subscriber badge"],
        badge_url: "https://cdn.streamfi.xyz/badges/creator-alpha/basic.png",
      });
    });

    it("does not leak internal fields like creator_id or active", async () => {
      const res = await GET(makeReq("creator-alpha"));
      const body = await res.json();

      for (const tier of body.tiers) {
        expect(tier).not.toHaveProperty("creator_id");
        expect(tier).not.toHaveProperty("active");
      }
    });

    it("scopes results to the requested creator_id", async () => {
      const res = await GET(makeReq("creator-beta"));
      const body = await res.json();

      expect(body.tiers).toHaveLength(1);
      expect(body.tiers[0].tier_id).toBe("tier_beta_basic");
    });

    it("returns an empty array for a creator with no tiers", async () => {
      const res = await GET(makeReq("unknown-creator"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tiers).toEqual([]);
    });
  });

  describe("utils: toListEntry", () => {
    it("strips creator_id and active from the tier", () => {
      const entry = toListEntry(subscriptionTierStore[0]);
      expect(entry).not.toHaveProperty("creator_id");
      expect(entry).not.toHaveProperty("active");
      expect(entry.tier_id).toBe(subscriptionTierStore[0].tier_id);
    });
  });

  describe("seedData: getActiveTiersForCreator", () => {
    it("excludes inactive tiers", () => {
      const tiers = getActiveTiersForCreator("creator-alpha");
      expect(tiers.every(t => t.active)).toBe(true);
    });
  });
});
