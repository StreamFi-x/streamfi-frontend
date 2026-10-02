import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import { clearAllSocialLinks } from "../store";
import { MAX_SOCIAL_LINKS } from "../types";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/channel/social-links");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePutReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel/social-links", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("channel/social-links", () => {
  beforeEach(() => {
    clearAllSocialLinks();
  });

  describe("GET", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("returns empty links for unknown creator", async () => {
      const res = await GET(makeGetReq({ creator_id: "creator_new" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.links).toEqual([]);
    });

    it("returns saved links", async () => {
      await PUT(
        makePutReq({
          creator_id: "creator_1",
          links: [
            { platform: "twitter", url: "https://twitter.com/streamer" },
            { platform: "discord", url: "https://discord.gg/streamfi" },
          ],
        })
      );

      const res = await GET(makeGetReq({ creator_id: "creator_1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.links).toHaveLength(2);
      expect(data.links[0].platform).toBe("twitter");
    });
  });

  describe("PUT", () => {
    it("overwrites links for a creator", async () => {
      await PUT(
        makePutReq({
          creator_id: "creator_1",
          links: [{ platform: "twitter", url: "https://twitter.com/old" }],
        })
      );

      const res = await PUT(
        makePutReq({
          creator_id: "creator_1",
          links: [
            { platform: "instagram", url: "https://instagram.com/streamer" },
          ],
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.links).toHaveLength(1);
      expect(data.links[0].platform).toBe("instagram");

      const getRes = await GET(makeGetReq({ creator_id: "creator_1" }));
      const getData = await getRes.json();
      expect(getData.links[0].url).toBe("https://instagram.com/streamer");
    });

    it("rejects invalid URLs", async () => {
      const res = await PUT(
        makePutReq({
          creator_id: "creator_1",
          links: [{ platform: "twitter", url: "not-a-valid-url" }],
        })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid URL");
    });

    it("rejects more than 8 links", async () => {
      const links = Array.from({ length: MAX_SOCIAL_LINKS + 1 }, (_, i) => ({
        platform: `platform_${i}`,
        url: `https://example.com/${i}`,
      }));

      const res = await PUT(
        makePutReq({ creator_id: "creator_1", links })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("8");
    });

    it("accepts exactly 8 links", async () => {
      const links = Array.from({ length: MAX_SOCIAL_LINKS }, (_, i) => ({
        platform: `platform_${i}`,
        url: `https://example.com/${i}`,
      }));

      const res = await PUT(
        makePutReq({ creator_id: "creator_1", links })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.links).toHaveLength(MAX_SOCIAL_LINKS);
    });

    it("allows clearing all links with empty array", async () => {
      await PUT(
        makePutReq({
          creator_id: "creator_1",
          links: [{ platform: "twitter", url: "https://twitter.com/streamer" }],
        })
      );

      const res = await PUT(
        makePutReq({ creator_id: "creator_1", links: [] })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.links).toEqual([]);
    });
  });
});
