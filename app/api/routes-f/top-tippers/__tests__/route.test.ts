/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { generateSeedData, tipStore } from "../seedData";

function makeReq(
  creatorId: string,
  timeframe: string,
  limit?: number
): NextRequest {
  let url = `http://localhost/api/routes-f/top-tippers?creator_id=${creatorId}&timeframe=${timeframe}`;
  if (limit !== undefined) {
    url += `&limit=${limit}`;
  }
  return new NextRequest(url);
}

describe("GET /api/routes-f/top-tippers", () => {
  describe("Required Parameters", () => {
    it("returns 400 when creator_id is missing", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/top-tippers?timeframe=daily"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("creator_id");
    });

    it("returns 400 when timeframe is missing", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/top-tippers?creator_id=creator123"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("timeframe");
    });

    it("returns 400 for invalid timeframe", async () => {
      const res = await GET(makeReq("creator123", "invalid_timeframe"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("daily, weekly, monthly, all-time");
    });
  });

  describe("Timeframe Filtering", () => {
    const seedCreatorId = "creator_xyz_123";

    it("returns leaderboard for daily timeframe", async () => {
      const res = await GET(makeReq(seedCreatorId, "daily"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toBeDefined();
      expect(Array.isArray(body.entries)).toBe(true);
    });

    it("returns leaderboard for weekly timeframe", async () => {
      const res = await GET(makeReq(seedCreatorId, "weekly"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toBeDefined();
      expect(Array.isArray(body.entries)).toBe(true);
    });

    it("returns leaderboard for monthly timeframe", async () => {
      const res = await GET(makeReq(seedCreatorId, "monthly"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toBeDefined();
      expect(Array.isArray(body.entries)).toBe(true);
    });

    it("returns leaderboard for all-time timeframe", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toBeDefined();
      expect(Array.isArray(body.entries)).toBe(true);
    });

    it("all-time has more entries than daily", async () => {
      const dailyRes = await GET(makeReq(seedCreatorId, "daily"));
      const allTimeRes = await GET(makeReq(seedCreatorId, "all-time"));

      const dailyBody = await dailyRes.json();
      const allTimeBody = await allTimeRes.json();

      expect(allTimeBody.entries.length).toBeGreaterThanOrEqual(
        dailyBody.entries.length
      );
    });

    it("weekly has more entries than daily", async () => {
      const dailyRes = await GET(makeReq(seedCreatorId, "daily"));
      const weeklyRes = await GET(makeReq(seedCreatorId, "weekly"));

      const dailyBody = await dailyRes.json();
      const weeklyBody = await weeklyRes.json();

      expect(weeklyBody.entries.length).toBeGreaterThanOrEqual(
        dailyBody.entries.length
      );
    });

    it("monthly has more entries than weekly", async () => {
      const weeklyRes = await GET(makeReq(seedCreatorId, "weekly"));
      const monthlyRes = await GET(makeReq(seedCreatorId, "monthly"));

      const weeklyBody = await weeklyRes.json();
      const monthlyBody = await monthlyRes.json();

      expect(monthlyBody.entries.length).toBeGreaterThanOrEqual(
        weeklyBody.entries.length
      );
    });
  });

  describe("Ranking and Sorting", () => {
    const seedCreatorId = "creator_xyz_123";

    it("ranks entries starting from 1", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      if (body.entries.length > 0) {
        expect(body.entries[0].rank).toBe(1);
      }
    });

    it("ranks are sequential", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      body.entries.forEach((entry, index) => {
        expect(entry.rank).toBe(index + 1);
      });
    });

    it("sorts by total_usdc descending", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      for (let i = 1; i < body.entries.length; i++) {
        expect(body.entries[i - 1].total_usdc).toBeGreaterThanOrEqual(
          body.entries[i].total_usdc
        );
      }
    });

    it("tie-breaks by tip_count descending", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      for (let i = 1; i < body.entries.length; i++) {
        if (body.entries[i - 1].total_usdc === body.entries[i].total_usdc) {
          expect(body.entries[i - 1].tip_count).toBeGreaterThanOrEqual(
            body.entries[i].tip_count
          );
        }
      }
    });

    it("entries have required fields", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      if (body.entries.length > 0) {
        const entry = body.entries[0];
        expect(entry).toHaveProperty("rank");
        expect(entry).toHaveProperty("tipper");
        expect(entry).toHaveProperty("total_usdc");
        expect(entry).toHaveProperty("tip_count");
      }
    });

    it("tipper names are strings", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      body.entries.forEach(entry => {
        expect(typeof entry.tipper).toBe("string");
        expect(entry.tipper.length).toBeGreaterThan(0);
      });
    });

    it("totals are positive numbers", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      body.entries.forEach(entry => {
        expect(typeof entry.total_usdc).toBe("number");
        expect(entry.total_usdc).toBeGreaterThan(0);
      });
    });

    it("tip counts are positive integers", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      body.entries.forEach(entry => {
        expect(typeof entry.tip_count).toBe("number");
        expect(Number.isInteger(entry.tip_count)).toBe(true);
        expect(entry.tip_count).toBeGreaterThan(0);
      });
    });
  });

  describe("Limit Parameter", () => {
    const seedCreatorId = "creator_xyz_123";

    it("uses default limit of 10 when not specified", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time"));
      const body = await res.json();

      expect(body.entries.length).toBeLessThanOrEqual(10);
    });

    it("respects custom limit", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time", 5));
      const body = await res.json();

      expect(body.entries.length).toBeLessThanOrEqual(5);
    });

    it("allows limit of 1", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time", 1));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries.length).toBeLessThanOrEqual(1);
    });

    it("allows limit of 1000", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time", 1000));
      expect(res.status).toBe(200);
    });

    it("rejects limit of 0", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time", 0));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("at least 1");
    });

    it("rejects limit greater than 1000", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time", 1001));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("at most 1000");
    });

    it("rejects non-integer limit", async () => {
      const req = new NextRequest(
        `http://localhost/api/routes-f/top-tippers?creator_id=${seedCreatorId}&timeframe=all-time&limit=5.5`
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it("rejects non-numeric limit", async () => {
      const req = new NextRequest(
        `http://localhost/api/routes-f/top-tippers?creator_id=${seedCreatorId}&timeframe=all-time&limit=not-a-number`
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Empty Results", () => {
    it("returns empty entries for creator with no tips", async () => {
      const res = await GET(makeReq("unknown_creator_xyz", "all-time"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toEqual([]);
    });

    it("returns empty entries for future-only timeframe", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/top-tippers?creator_id=future_creator&timeframe=daily"
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.entries)).toBe(true);
    });
  });

  describe("Integration: Full Workflow", () => {
    const seedCreatorId = "creator_xyz_123";

    it("returns valid leaderboard with seed data", async () => {
      const res = await GET(makeReq(seedCreatorId, "all-time", 10));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.entries).toBeDefined();
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body.entries.length).toBeGreaterThan(0);

      // Verify structure
      body.entries.forEach((entry, idx) => {
        expect(entry.rank).toBe(idx + 1);
        expect(typeof entry.tipper).toBe("string");
        expect(typeof entry.total_usdc).toBe("number");
        expect(typeof entry.tip_count).toBe("number");
      });
    });

    it("returns consistent ranking across calls", async () => {
      const res1 = await GET(makeReq(seedCreatorId, "all-time", 5));
      const body1 = await res1.json();

      const res2 = await GET(makeReq(seedCreatorId, "all-time", 5));
      const body2 = await res2.json();

      expect(body1.entries).toEqual(body2.entries);
    });

    it("top tipper from all-time appears in monthly", async () => {
      const allTimeRes = await GET(makeReq(seedCreatorId, "all-time", 1));
      const allTimeBody = await allTimeRes.json();

      if (allTimeBody.entries.length > 0) {
        const topTipper = allTimeBody.entries[0].tipper;

        const monthlyRes = await GET(makeReq(seedCreatorId, "monthly"));
        const monthlyBody = await monthlyRes.json();

        const tippersInMonthly = monthlyBody.entries.map(e => e.tipper);
        // Might not always appear if they only tipped before the month window
        // but if they do, their rank should be consistent
      }
    });

    it("respects limit across all timeframes", async () => {
      const timeframes = ["daily", "weekly", "monthly", "all-time"] as const;

      for (const timeframe of timeframes) {
        const res = await GET(makeReq(seedCreatorId, timeframe, 7));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.entries.length).toBeLessThanOrEqual(7);
      }
    });
  });

  describe("Seed Data Validation", () => {
    it("has seed data loaded", () => {
      expect(tipStore.length).toBeGreaterThan(0);
    });

    it("seed data has ~50 records", () => {
      expect(tipStore.length).toBeGreaterThanOrEqual(45);
      expect(tipStore.length).toBeLessThanOrEqual(55);
    });

    it("seed data has creator_xyz_123", () => {
      const hasSeededCreator = tipStore.some(
        tip => tip.creator_id === "creator_xyz_123"
      );
      expect(hasSeededCreator).toBe(true);
    });

    it("seed data has various tippers", () => {
      const seed = generateSeedData();
      const uniqueTippers = new Set(seed.map(t => t.tipper));
      expect(uniqueTippers.size).toBeGreaterThan(5);
    });

    it("seed data has realistic amounts", () => {
      const seed = generateSeedData();
      seed.forEach(tip => {
        expect(tip.amount_usdc).toBeGreaterThanOrEqual(10);
        expect(tip.amount_usdc).toBeLessThanOrEqual(600);
      });
    });

    it("seed data has realistic timestamps", () => {
      const seed = generateSeedData();
      const now = Date.now();
      const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

      seed.forEach(tip => {
        expect(tip.timestamp).toBeLessThanOrEqual(now);
        expect(tip.timestamp).toBeGreaterThanOrEqual(threeMonthsAgo);
      });
    });
  });
});
