import { GET } from "../route";
import { NextRequest } from "next/server";

function makeReq(url: string) {
  return new NextRequest(url);
}

describe("GET /api/routes-f/currency", () => {
  describe("conversions", () => {
    it("converts USD to EUR", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR&amount=100")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.converted).toBe(92.5);
      expect(body.rate).toBeCloseTo(0.925, 4);
    });

    it("converts EUR to GBP", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=EUR&to=GBP&amount=50")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.converted).toBe("number");
      expect(body.converted).toBeGreaterThan(0);
    });

    it("converts to same currency (rate = 1)", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=USD&amount=100")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.converted).toBe(100);
      expect(body.rate).toBe(1);
    });

    it("handles small amounts", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR&amount=0.01")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.converted).toBeCloseTo(0.01, 4);
    });
  });

  describe("rounding", () => {
    it("rounds converted amount to 2 decimal places", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=JPY&amount=1")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.converted).toBe(Math.round(149.5 * 100) / 100);
    });

    it("rounds rate to 4 decimal places", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR&amount=100")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(String(body.rate).split(".")[1]?.length || 0).toBeLessThanOrEqual(4);
    });
  });

  describe("validation", () => {
    it("returns 400 for missing from parameter", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?to=EUR&amount=100")
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns 400 for missing to parameter", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&amount=100")
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing amount parameter", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR")
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for unknown source currency", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=XXX&to=EUR&amount=100")
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unknown currency");
    });

    it("returns 400 for unknown target currency", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=YYY&amount=100")
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unknown currency");
    });

    it("returns 400 for non-numeric amount", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR&amount=abc")
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for negative amount", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR&amount=-50")
      );
      expect(res.status).toBe(400);
    });
  });

  describe("response", () => {
    it("includes as_of timestamp", async () => {
      const res = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR&amount=100")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.as_of).toBeDefined();
      expect(typeof body.as_of).toBe("string");
      // Check it's a valid ISO string
      expect(new Date(body.as_of).getTime()).toBeGreaterThan(0);
    });

    it("supports case-insensitive currency codes", async () => {
      const res1 = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=usd&to=eur&amount=100")
      );
      const res2 = await GET(
        makeReq("http://localhost/api/routes-f/currency?from=USD&to=EUR&amount=100")
      );
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.converted).toBe(body2.converted);
    });
  });
});
