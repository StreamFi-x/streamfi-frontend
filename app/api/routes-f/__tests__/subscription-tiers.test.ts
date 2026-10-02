/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../subscription-tiers/route";

function makeReq(body?: unknown) {
  return new NextRequest("http://localhost/api/routes-f/subscription-tiers", {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeAuthReq(body: unknown) {
  const req = new NextRequest("http://localhost/api/routes-f/subscription-tiers", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "session=mock-token",
    },
    body: JSON.stringify(body),
  });
  return req;
}

describe("/api/routes-f/subscription-tiers", () => {
  describe("POST", () => {
    it("creates a tier with valid fields", async () => {
      const req = makeAuthReq({
        name: "Basic",
        price_usdc: 5,
        duration_days: 30,
        perks: ["badge"],
      });
      const res = await POST(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data).toHaveProperty("id");
      expect(data.name).toBe("Basic");
      expect(data.price_usdc).toBe(5);
    });

    it("rejects tier with missing name", async () => {
      const req = makeAuthReq({
        price_usdc: 5,
        duration_days: 30,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects tier with zero price", async () => {
      const req = makeAuthReq({
        name: "Free",
        price_usdc: 0,
        duration_days: 30,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects tier with negative duration", async () => {
      const req = makeAuthReq({
        name: "Bad",
        price_usdc: 5,
        duration_days: -1,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("caps at 5 tiers per creator", async () => {
      for (let i = 0; i < 5; i++) {
        const req = makeAuthReq({
          name: `Tier ${i}`,
          price_usdc: i + 1,
          duration_days: 30,
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
      }

      const sixthReq = makeAuthReq({
        name: "Tier 6",
        price_usdc: 6,
        duration_days: 30,
      });
      const sixthRes = await POST(sixthReq);
      expect(sixthRes.status).toBe(400);

      const data = await sixthRes.json();
      expect(data.error).toContain("Cannot exceed 5");
    });
  });

  describe("GET", () => {
    it("lists tiers for creator", async () => {
      const req = makeReq();
      req.nextUrl.searchParams.set("creator_id", "user123");

      const res = await GET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty("tiers");
      expect(Array.isArray(data.tiers)).toBe(true);
    });

    it("rejects missing creator_id", async () => {
      const req = makeReq();
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });
});
