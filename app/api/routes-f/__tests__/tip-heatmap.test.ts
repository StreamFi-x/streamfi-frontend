/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, buildHeatmap } from "../tip-heatmap/route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/tip-heatmap");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("Tip Heatmap API", () => {
  describe("GET /api/routes-f/tip-heatmap", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeGet({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("creator_id is required");
    });

    it("returns a 7x24 matrix", async () => {
      const res = await GET(makeGet({ creator_id: "creator-1" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.heatmap).toHaveLength(7);
      body.heatmap.forEach((row: number[]) => expect(row).toHaveLength(24));
    });

    it("returns the creator timezone in the response", async () => {
      const res = await GET(makeGet({ creator_id: "creator-1" }));
      const body = await res.json();
      expect(body.timezone).toBe("America/New_York");
    });

    it("uses UTC for unknown creator", async () => {
      const res = await GET(makeGet({ creator_id: "unknown-creator" }));
      const body = await res.json();
      expect(body.timezone).toBe("UTC");
    });
  });

  describe("buildHeatmap bucket math", () => {
    it("places a known UTC tip into the correct NY bucket", () => {
      // 2024-01-15T20:00:00Z = Monday 15:00 in America/New_York (EST = UTC-5)
      const tips = [{ creator_id: "c1", amount_usdc: 5.0, ts: "2024-01-15T20:00:00Z" }];
      const matrix = buildHeatmap(tips, "c1", "America/New_York");
      expect(matrix[1][15]).toBe(5.0);
    });

    it("places a known UTC tip into the correct London bucket", () => {
      // 2024-06-15T14:00:00Z = Saturday 15:00 in Europe/London (BST = UTC+1)
      const tips = [{ creator_id: "c2", amount_usdc: 3.0, ts: "2024-06-15T14:00:00Z" }];
      const matrix = buildHeatmap(tips, "c2", "Europe/London");
      expect(matrix[6][15]).toBe(3.0);
    });

    it("accumulates multiple tips in the same bucket", () => {
      const tips = [
        { creator_id: "c1", amount_usdc: 2.0, ts: "2024-01-15T20:00:00Z" },
        { creator_id: "c1", amount_usdc: 3.5, ts: "2024-01-15T20:30:00Z" },
      ];
      const matrix = buildHeatmap(tips, "c1", "America/New_York");
      expect(matrix[1][15]).toBeCloseTo(5.5);
    });

    it("ignores tips from other creators", () => {
      const tips = [{ creator_id: "other", amount_usdc: 99.0, ts: "2024-01-15T20:00:00Z" }];
      const matrix = buildHeatmap(tips, "c1", "America/New_York");
      const total = matrix.flat().reduce((a, b) => a + b, 0);
      expect(total).toBe(0);
    });
  });
});
