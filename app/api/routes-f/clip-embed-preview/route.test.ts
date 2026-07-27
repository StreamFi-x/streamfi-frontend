import { GET, SEED_CLIPS } from "./route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/clip-embed-preview";

async function fetchPreview(query = "") {
  const res = await GET(new NextRequest(`${BASE}${query}`));
  return { res, data: await res.json() };
}

describe("Clip Embed Preview", () => {
  describe("GET /api/routes-f/clip-embed-preview", () => {
    it("should return 400 when clip_id is missing", async () => {
      const { res } = await fetchPreview();
      expect(res.status).toBe(400);
    });

    it("should return 404 for an unknown clip_id", async () => {
      const { res } = await fetchPreview("?clip_id=does-not-exist");
      expect(res.status).toBe(404);
    });

    it("should return oembed-shaped data for a public clip", async () => {
      const publicClip = SEED_CLIPS.find((c) => c.privacy === "public")!;
      const { res, data } = await fetchPreview(`?clip_id=${publicClip.clip_id}`);

      expect(res.status).toBe(200);
      expect(data.type).toBe("video");
      expect(data.title).toBe(publicClip.title);
      expect(data.author_name).toBe(publicClip.creator_name);
      expect(data.thumbnail_url).toBe(publicClip.thumbnail_url);
      expect(typeof data.html).toBe("string");
      expect(data.html).toContain("iframe");
    });

    it("should include twitter:card meta hints", async () => {
      const publicClip = SEED_CLIPS.find((c) => c.privacy === "public")!;
      const { data } = await fetchPreview(`?clip_id=${publicClip.clip_id}`);

      expect(data.twitter_card).toBe("player");
      expect(data.twitter_title).toBe(publicClip.title);
      expect(data.twitter_image).toBe(publicClip.thumbnail_url);
      expect(typeof data.twitter_player).toBe("string");
    });

    it("should return 403 for a subscribers-only clip", async () => {
      const privateClip = SEED_CLIPS.find((c) => c.privacy === "subscribers-only")!;
      const { res } = await fetchPreview(`?clip_id=${privateClip.clip_id}`);
      expect(res.status).toBe(403);
    });
  });
});
