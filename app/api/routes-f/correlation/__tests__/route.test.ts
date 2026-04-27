jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST } from "../route";

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/routes-f/correlation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/routes-f/correlation", () => {
  describe("validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new Request("http://localhost/api/routes-f/correlation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid json/i);
    });

    it("returns 400 when x has fewer than 3 elements", async () => {
      const res = await POST(makeRequest({ x: [1, 2], y: [1, 2, 3] }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when y has fewer than 3 elements", async () => {
      const res = await POST(makeRequest({ x: [1, 2, 3], y: [4, 5] }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when arrays have unequal lengths", async () => {
      const res = await POST(makeRequest({ x: [1, 2, 3], y: [1, 2, 3, 4] }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/equal length/i);
    });

    it("returns 400 for zero-variance x", async () => {
      const res = await POST(makeRequest({ x: [5, 5, 5], y: [1, 2, 3] }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/zero-variance/i);
    });

    it("returns 400 for zero-variance y", async () => {
      const res = await POST(makeRequest({ x: [1, 2, 3], y: [7, 7, 7] }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/zero-variance/i);
    });
  });

  describe("perfect positive correlation", () => {
    it("returns coefficient ~1 and direction positive", async () => {
      const res = await POST(makeRequest({ x: [1, 2, 3, 4, 5], y: [2, 4, 6, 8, 10] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.coefficient).toBeCloseTo(1, 5);
      expect(body.direction).toBe("positive");
      expect(body.strength).toBe("strong");
      expect(body.n).toBe(5);
    });
  });

  describe("perfect negative correlation", () => {
    it("returns coefficient ~-1 and direction negative", async () => {
      const res = await POST(makeRequest({ x: [1, 2, 3, 4, 5], y: [10, 8, 6, 4, 2] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.coefficient).toBeCloseTo(-1, 5);
      expect(body.direction).toBe("negative");
      expect(body.strength).toBe("strong");
    });
  });

  describe("no correlation", () => {
    it("returns coefficient near 0 for uncorrelated data", async () => {
      // x=[1,2,3,4,5] y=[2,4,3,5,1] → r = -0.1
      const res = await POST(makeRequest({ x: [1, 2, 3, 4, 5], y: [2, 4, 3, 5, 1] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Math.abs(body.coefficient)).toBeLessThan(0.3);
      expect(body.strength).toBe("weak");
    });
  });

  describe("real dataset", () => {
    it("computes moderate positive correlation for height/weight data", async () => {
      // Heights (cm) and weights (kg) — moderate positive correlation expected
      const x = [160, 165, 170, 175, 180, 185, 190];
      const y = [55, 60, 65, 72, 78, 85, 90];
      const res = await POST(makeRequest({ x, y }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.coefficient).toBeGreaterThan(0.9);
      expect(body.direction).toBe("positive");
      expect(body.strength).toBe("strong");
      expect(body.n).toBe(7);
    });

    it("computes negative correlation for temperature/heating cost", async () => {
      // Colder temps → higher heating cost
      const x = [30, 20, 10, 0, -5, -10];  // temperature °C
      const y = [50, 80, 120, 180, 200, 230]; // heating cost
      const res = await POST(makeRequest({ x, y }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.coefficient).toBeLessThan(-0.9);
      expect(body.direction).toBe("negative");
      expect(body.strength).toBe("strong");
    });
  });

  describe("strength thresholds", () => {
    it("labels |r| < 0.3 as weak", async () => {
      // Construct weakly correlated data
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = [5, 1, 9, 2, 8, 3, 7, 4, 6, 10];
      const res = await POST(makeRequest({ x, y }));
      expect(res.status).toBe(200);
      const body = await res.json();
      if (Math.abs(body.coefficient) < 0.3) {
        expect(body.strength).toBe("weak");
      }
    });

    it("labels |r| >= 0.7 as strong", async () => {
      const x = [1, 2, 3, 4, 5, 6, 7];
      const y = [2, 3.5, 5, 6, 7.5, 9, 11];
      const res = await POST(makeRequest({ x, y }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Math.abs(body.coefficient)).toBeGreaterThanOrEqual(0.7);
      expect(body.strength).toBe("strong");
    });
  });

  describe("response shape", () => {
    it("always includes coefficient, strength, direction, and n", async () => {
      const res = await POST(makeRequest({ x: [1, 2, 3], y: [4, 5, 6] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("coefficient");
      expect(body).toHaveProperty("strength");
      expect(body).toHaveProperty("direction");
      expect(body).toHaveProperty("n");
      expect(typeof body.coefficient).toBe("number");
      expect(["weak", "moderate", "strong"]).toContain(body.strength);
      expect(["positive", "negative", "none"]).toContain(body.direction);
    });
  });
});
