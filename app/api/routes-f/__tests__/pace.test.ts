/**
 * @jest-environment node
 */
import { POST } from "../pace/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/pace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/pace", () => {
  describe("mode: pace (distance + time → pace)", () => {
    it("computes pace from 10km in 50:00", async () => {
      const res = await POST(makeReq({ mode: "pace", distance: 10, time: "00:50:00" }));
      expect(res.status).toBe(200);
      const d = await res.json();
      expect(d.pace).toBe("5:00 per km");
    });

    it("includes race splits", async () => {
      const res = await POST(makeReq({ mode: "pace", distance: 10, time: "01:00:00" }));
      const d = await res.json();
      expect(d.race_splits["5K"]).toBeDefined();
      expect(d.race_splits["Marathon"]).toBeDefined();
    });
  });

  describe("mode: time (distance + pace → time)", () => {
    it("computes time for 5km at 6:00/km", async () => {
      const res = await POST(makeReq({ mode: "time", distance: 5, pace: "6:00" }));
      expect(res.status).toBe(200);
      const d = await res.json();
      expect(d.time).toBe("00:30:00");
    });

    it("computes marathon time at 4:30/km pace", async () => {
      const res = await POST(makeReq({ mode: "time", distance: 42.195, pace: "4:30" }));
      const d = await res.json();
      // 42.195 * 270s ≈ 11392.65s ≈ 3h 9m 52s
      expect(d.time).toMatch(/^03:/);
    });
  });

  describe("mode: distance (time + pace → distance)", () => {
    it("computes distance for 1h at 5:00/km", async () => {
      const res = await POST(makeReq({ mode: "distance", time: "01:00:00", pace: "5:00" }));
      expect(res.status).toBe(200);
      const d = await res.json();
      expect(d.distance).toBeCloseTo(12, 0);
    });
  });

  describe("mile unit support", () => {
    it("computes pace in miles", async () => {
      const res = await POST(makeReq({ mode: "pace", distance: 6.2, time: "00:50:00", unit: "mi" }));
      expect(res.status).toBe(200);
      const d = await res.json();
      expect(d.pace).toContain("per mi");
    });
  });

  describe("validation", () => {
    it("rejects invalid mode", async () => {
      const res = await POST(makeReq({ mode: "speed", distance: 10, time: "00:50:00" }));
      expect(res.status).toBe(400);
    });

    it("rejects invalid unit", async () => {
      const res = await POST(makeReq({ mode: "pace", distance: 10, time: "00:50:00", unit: "meters" }));
      expect(res.status).toBe(400);
    });

    it("rejects invalid time format", async () => {
      const res = await POST(makeReq({ mode: "pace", distance: 10, time: "not-a-time" }));
      expect(res.status).toBe(400);
    });

    it("rejects invalid pace format", async () => {
      const res = await POST(makeReq({ mode: "time", distance: 10, pace: "fast" }));
      expect(res.status).toBe(400);
    });

    it("rejects zero distance", async () => {
      const res = await POST(makeReq({ mode: "pace", distance: 0, time: "00:30:00" }));
      expect(res.status).toBe(400);
    });
  });
});
