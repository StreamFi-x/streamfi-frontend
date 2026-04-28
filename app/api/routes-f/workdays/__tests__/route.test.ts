import { POST } from "../route";
import { NextRequest } from "next/server";

// Helper to create a mock NextRequest
function createMockRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/workdays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/workdays", () => {
  describe("Valid requests", () => {
    it("calculates workdays for same-day weekday", async () => {
      const req = createMockRequest({ from: "2024-01-02", to: "2024-01-02" }); // Tuesday
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.workdays).toBe(1);
      expect(data.total_days).toBe(1);
      expect(data.holidays_in_range).toBe(0);
      expect(data.weekend_days_used).toBe(0);
    });

    it("calculates workdays for weekend-only range", async () => {
      const req = createMockRequest({ from: "2024-01-05", to: "2024-01-07" }); // Fri to Sun
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.workdays).toBe(1); // Fri
      expect(data.total_days).toBe(3);
      expect(data.holidays_in_range).toBe(0);
      expect(data.weekend_days_used).toBe(2); // Sat Sun
    });

    it("includes holidays in range", async () => {
      const req = createMockRequest({
        from: "2024-01-01",
        to: "2024-01-03",
        country: "US",
      }); // New Year and after
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.workdays).toBe(1); // Jan 2 (Tue), Jan 1 holiday, Jan 3 Wed but weekend? Wait, Jan 3 is Wed, but range to 3, total 3 days
      // from 1/1 to 1/3: 1/1 holiday, 1/2 weekday, 1/3 weekday
      expect(data.total_days).toBe(3);
      expect(data.holidays_in_range).toBe(1);
      expect(data.weekend_days_used).toBe(0);
      expect(data.workdays).toBe(2);
    });

    it("uses custom weekend days", async () => {
      const req = createMockRequest({
        from: "2024-01-01",
        to: "2024-01-02",
        weekend_days: [1],
      }); // Mon as weekend
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.workdays).toBe(1); // Jan 1 is Tue? Wait, 1/1/2024 is Monday! Wait, let's check.
      // Actually, 2024-01-01 is Monday, so if weekend_days=[1], Monday is weekend.
      // But in request, from 1/1 Mon to 1/2 Tue, total 2, weekend_days_used=1 (Mon), workdays=1 (Tue)
      expect(data.total_days).toBe(2);
      expect(data.weekend_days_used).toBe(1);
      expect(data.workdays).toBe(1);
    });

    it("includes custom holidays", async () => {
      const req = createMockRequest({
        from: "2024-01-02",
        to: "2024-01-02",
        custom_holidays: ["2024-01-02"],
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.workdays).toBe(0);
      expect(data.total_days).toBe(1);
      expect(data.holidays_in_range).toBe(1);
      expect(data.weekend_days_used).toBe(0);
    });
  });

  describe("Invalid inputs", () => {
    it("rejects missing from", async () => {
      const req = createMockRequest({ to: "2024-01-02" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("from and to must be strings");
    });

    it("rejects invalid date", async () => {
      const req = createMockRequest({ from: "invalid", to: "2024-01-02" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid date format");
    });

    it("rejects from after to", async () => {
      const req = createMockRequest({ from: "2024-01-02", to: "2024-01-01" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain(
        "from date must be before or equal to to date"
      );
    });

    it("rejects invalid country type", async () => {
      const req = createMockRequest({
        from: "2024-01-01",
        to: "2024-01-02",
        country: 123,
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("country must be a string");
    });

    it("rejects invalid custom_holidays", async () => {
      const req = createMockRequest({
        from: "2024-01-01",
        to: "2024-01-02",
        custom_holidays: "not array",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("custom_holidays must be an array");
    });

    it("rejects invalid weekend_days", async () => {
      const req = createMockRequest({
        from: "2024-01-01",
        to: "2024-01-02",
        weekend_days: "not array",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("weekend_days must be an array");
    });
  });
});
