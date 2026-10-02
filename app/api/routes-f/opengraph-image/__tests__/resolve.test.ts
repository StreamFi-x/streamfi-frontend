import { resolveOgImageData } from "../resolve";

describe("resolveOgImageData (#1549)", () => {
  it("rejects a missing type", () => {
    const result = resolveOgImageData({ type: null, id: "moonshot_dev" });
    expect(result.ok).toBe(false);
    if (!result.ok) {expect(result.error).toMatch(/type must be/i);}
  });

  it("rejects an invalid type", () => {
    const result = resolveOgImageData({ type: "stream", id: "moonshot_dev" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing id", () => {
    const result = resolveOgImageData({ type: "channel", id: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {expect(result.error).toMatch(/id is required/i);}
  });

  it("resolves a known live channel with its stream title", () => {
    const result = resolveOgImageData({ type: "channel", id: "moonshot_dev" });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.kind === "channel") {
      expect(result.data.displayName).toBe("moonshot_dev");
      expect(result.data.isLive).toBe(true);
      expect(result.data.streamTitle).toBe("Building on Stellar");
    }
  });

  it("resolves a known offline channel with a null stream title", () => {
    const result = resolveOgImageData({ type: "channel", id: "stellar_samurai" });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.kind === "channel") {
      expect(result.data.isLive).toBe(false);
      expect(result.data.streamTitle).toBeNull();
    }
  });

  it("falls back to a generic channel image for an unknown channel id, rather than erroring", () => {
    const result = resolveOgImageData({ type: "channel", id: "totally_unknown_channel" });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.kind === "channel") {
      expect(result.data.displayName).toBe("totally_unknown_channel");
      expect(result.data.isLive).toBe(false);
    }
  });

  it("resolves a known clip with its thumbnail and title", () => {
    const result = resolveOgImageData({ type: "clip", id: "clip_001" });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.kind === "clip") {
      expect(result.data.clipTitle).toBe("Soroban deploy in 60s");
      expect(result.data.thumbnailUrl).toContain("clip_001_playback");
    }
  });

  it("resolves a known clip with no custom thumbnail as null, not a broken URL", () => {
    const result = resolveOgImageData({ type: "clip", id: "clip_002" });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.kind === "clip") {
      expect(result.data.thumbnailUrl).toBeNull();
    }
  });

  it("falls back to a generic clip image for an unknown clip id, rather than erroring", () => {
    const result = resolveOgImageData({ type: "clip", id: "totally_unknown_clip" });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.kind === "clip") {
      expect(result.data.thumbnailUrl).toBeNull();
    }
  });
});
