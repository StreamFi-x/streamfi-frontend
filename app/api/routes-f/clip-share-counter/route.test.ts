import { GET, POST, CLIP_SHARES } from "./route";
import { NextRequest } from "next/server";

describe("Clip Share Counter", () => {
  beforeEach(() => {
    // Reset in-memory store before each test
    for (const key in CLIP_SHARES) {
      delete CLIP_SHARES[key];
    }
  });

  describe("POST /api/routes-f/clip-share-counter", () => {
    it("should increment share counter for valid destination", async () => {
      const req = new NextRequest("http://localhost/api/routes-f/clip-share-counter", {
        method: "POST",
        body: JSON.stringify({ clip_id: "clip-123", destination: "twitter" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(CLIP_SHARES["clip-123"].twitter).toBe(1);
    });

    it("should return 400 for invalid destination", async () => {
      const req = new NextRequest("http://localhost/api/routes-f/clip-share-counter", {
        method: "POST",
        body: JSON.stringify({ clip_id: "clip-123", destination: "facebook" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid destination");
    });
  });

  describe("GET /api/routes-f/clip-share-counter", () => {
    it("should return correct totals and by_destination aggregations", async () => {
      // Simulate some shares
      CLIP_SHARES["clip-456"] = {
        twitter: 2,
        telegram: 1,
        copy_link: 0,
        other: 3,
      };

      const req = new NextRequest("http://localhost/api/routes-f/clip-share-counter?clip_id=clip-456");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(6);
      expect(data.by_destination.twitter).toBe(2);
      expect(data.by_destination.telegram).toBe(1);
      expect(data.by_destination.other).toBe(3);
    });

    it("should return zeros for unknown clip_id", async () => {
      const req = new NextRequest("http://localhost/api/routes-f/clip-share-counter?clip_id=unknown");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(0);
      expect(data.by_destination.twitter).toBe(0);
    });
  });
});
