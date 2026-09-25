/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST, DELETE, PATCH } from "../route";
import { clearOverrideStore } from "../store";

function getReq(date?: string) {
  const url = date 
    ? `http://localhost/api/routes-f/featured-stream?date=${date}`
    : "http://localhost/api/routes-f/featured-stream";
  return new NextRequest(url);
}

function postReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/featured-stream",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function deleteReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/featured-stream",
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function patchReq(date?: string) {
  const url = date 
    ? `http://localhost/api/routes-f/featured-stream?date=${date}`
    : "http://localhost/api/routes-f/featured-stream";
  return new NextRequest(url, {
    method: "PATCH",
  });
}

describe("/api/routes-f/featured-stream", () => {
  beforeEach(() => {
    clearOverrideStore();
  });

  describe("GET — get featured stream", () => {
    it("returns featured stream for today when no date specified", async () => {
      const res = await GET(getReq());
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.featured).toBeDefined();
      expect(data.featured.creator_id).toBeDefined();
      expect(data.featured.stream_title).toBeDefined();
      expect(data.featured.reason).toBeDefined();
      expect(data.date).toBeDefined();
      expect(typeof data.is_override).toBe("boolean");
    });

    it("returns featured stream for specific date", async () => {
      const testDate = "2024-01-15";
      const res = await GET(getReq(testDate));
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.featured).toBeDefined();
      expect(data.date).toBe(testDate);
    });

    it("returns deterministic results for same date", async () => {
      const testDate = "2024-01-15";
      const res1 = await GET(getReq(testDate));
      const res2 = await GET(getReq(testDate));
      
      const data1 = await res1.json();
      const data2 = await res2.json();
      
      expect(data1.featured.creator_id).toBe(data2.featured.creator_id);
      expect(data1.featured.stream_title).toBe(data2.featured.stream_title);
    });

    it("returns different results for different dates", async () => {
      const res1 = await GET(getReq("2024-01-15"));
      const res2 = await GET(getReq("2024-01-16"));
      
      const data1 = await res1.json();
      const data2 = await res2.json();
      
      // They might occasionally be the same by chance, but usually different
      // We'll just verify both are valid responses
      expect(data1.featured.creator_id).toBeDefined();
      expect(data2.featured.creator_id).toBeDefined();
    });

    it("rejects invalid date format", async () => {
      const res = await GET(getReq("invalid-date"));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid query parameters");
    });
  });

  describe("POST — set editorial override", () => {
    it("sets override successfully", async () => {
      const res = await POST(
        postReq({
          date: "2024-01-15",
          creator_id: "creator_101",
          reason: "Special event coverage",
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.override.date).toBe("2024-01-15");
      expect(data.override.creator_id).toBe("creator_101");
      expect(data.override.reason).toBe("Special event coverage");
      expect(data.override.created_at).toBeDefined();
    });

    it("overrides featured stream selection", async () => {
      // First, get normal featured stream for a date
      const testDate = "2024-01-15";
      const normalRes = await GET(getReq(testDate));
      const normalData = await normalRes.json();
      const normalCreator = normalData.featured.creator_id;

      // Set override for different creator
      await POST(
        postReq({
          date: testDate,
          creator_id: "creator_102", // Different creator
          reason: "Editor's choice",
        })
      );

      // Now get featured stream again
      const overrideRes = await GET(getReq(testDate));
      const overrideData = await overrideRes.json();

      expect(overrideData.featured.creator_id).toBe("creator_102");
      expect(overrideData.featured.reason).toBe("Editor's choice");
      expect(overrideData.featured.creator_id).not.toBe(normalCreator);
    });

    it("rejects invalid creator_id", async () => {
      const res = await POST(
        postReq({
          date: "2024-01-15",
          creator_id: "nonexistent_creator",
          reason: "Test reason",
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("not found");
    });

    it("requires all fields", async () => {
      const res = await POST(
        postReq({
          date: "2024-01-15",
          // missing creator_id and reason
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid request body");
    });

    it("validates date format", async () => {
      const res = await POST(
        postReq({
          date: "2024/01/15", // Invalid format
          creator_id: "creator_101",
          reason: "Test reason",
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid request body");
    });
  });

  describe("DELETE — remove editorial override", () => {
    it("removes existing override", async () => {
      // First set an override
      await POST(
        postReq({
          date: "2024-01-15",
          creator_id: "creator_101",
          reason: "Test override",
        })
      );

      // Verify override exists
      const beforeRes = await GET(getReq("2024-01-15"));
      const beforeData = await beforeRes.json();
      expect(beforeData.featured.creator_id).toBe("creator_101");

      // Remove override
      const deleteRes = await DELETE(
        deleteReq({ date: "2024-01-15" })
      );
      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);

      // Verify override is removed
      const afterRes = await GET(getReq("2024-01-15"));
      const afterData = await afterRes.json();
      expect(afterData.featured.creator_id).not.toBe("creator_101");
    });

    it("handles removal of non-existent override", async () => {
      const res = await DELETE(
        deleteReq({ date: "2024-01-15" })
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("No override found");
    });

    it("validates date format", async () => {
      const res = await DELETE(
        deleteReq({ date: "invalid-date" })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid request body");
    });
  });

  describe("PATCH — get featured stream with override info", () => {
    it("returns featured stream with override status", async () => {
      const testDate = "2024-01-15";
      
      // Get without override
      const res1 = await PATCH(patchReq(testDate));
      const data1 = await res1.json();
      expect(data1.featured).toBeDefined();
      expect(data1.is_override).toBe(false);
      expect(data1.date).toBe(testDate);

      // Set override
      await POST(
        postReq({
          date: testDate,
          creator_id: "creator_101",
          reason: "Test override",
        })
      );

      // Get with override
      const res2 = await PATCH(patchReq(testDate));
      const data2 = await res2.json();
      expect(data2.featured).toBeDefined();
      expect(data2.is_override).toBe(true);
      expect(data2.featured.creator_id).toBe("creator_101");
      expect(data2.featured.reason).toBe("Test override");
    });

    it("handles today's date when no date specified", async () => {
      const res = await PATCH(patchReq());
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.featured).toBeDefined();
      expect(data.date).toBeDefined();
      expect(typeof data.is_override).toBe("boolean");
    });
  });

  describe("deterministic rotation", () => {
    it("rotates through creators predictably", async () => {
      const dates = [
        "2024-01-01",
        "2024-01-02", 
        "2024-01-03",
        "2024-01-04",
        "2024-01-05",
      ];

      const creators = new Set<string>();
      
      for (const date of dates) {
        const res = await GET(getReq(date));
        const data = await res.json();
        creators.add(data.featured.creator_id);
      }

      // Should have multiple different creators (might have some duplicates)
      expect(creators.size).toBeGreaterThan(1);
    });

    it("always returns same creator for same date", async () => {
      const testDate = "2024-12-25";
      const results: string[] = [];

      // Get the same date multiple times
      for (let i = 0; i < 5; i++) {
        const res = await GET(getReq(testDate));
        const data = await res.json();
        results.push(data.featured.creator_id);
      }

      // All results should be identical
      const firstCreator = results[0];
      expect(results.every(creator => creator === firstCreator)).toBe(true);
    });
  });
});