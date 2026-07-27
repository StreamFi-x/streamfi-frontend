import { NextRequest } from "next/server";
import { GET } from "./route";
import { creatorPresetStore } from "./store";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/automod-presets");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Auto-Mod Preset Packs", () => {
  beforeEach(() => {
    creatorPresetStore.clear();
  });

  describe("GET /api/routesF/automod-presets", () => {
    it("returns all available preset packs when no creator_id is given", async () => {
      const res = await GET(makeReq());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.presets).toHaveLength(3);
      const slugs = data.presets.map((p: { slug: string }) => p.slug);
      expect(slugs.sort()).toEqual(["family_safe", "permissive", "strict"]);
    });

    it("each preset includes rules", async () => {
      const res = await GET(makeReq());
      const data = await res.json();
      for (const preset of data.presets) {
        expect(preset.rules).toHaveProperty("block_profanity");
        expect(preset.rules).toHaveProperty("block_links");
        expect(preset.rules).toHaveProperty("slow_mode_seconds");
      }
    });

    it("returns null preset/rules for a creator with no preset applied", async () => {
      const res = await GET(makeReq({ creator_id: "creator-1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.preset).toBeNull();
      expect(data.rules).toBeNull();
    });

    it("returns the applied preset and rules for a creator", async () => {
      creatorPresetStore.set("creator-1", "strict");
      const res = await GET(makeReq({ creator_id: "creator-1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.preset).toBe("strict");
      expect(data.rules.block_profanity).toBe(true);
    });
  });
});
