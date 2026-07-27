import { NextRequest } from "next/server";
import { POST } from "./route";
import { creatorPresetStore } from "../store";

const BASE = "http://localhost/api/routesF/automod-presets/apply";

function postApply(body: unknown) {
  return POST(
    new NextRequest(BASE, {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("Auto-Mod Preset Apply", () => {
  beforeEach(() => {
    creatorPresetStore.clear();
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await postApply({ preset_slug: "strict" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when preset_slug is missing", async () => {
    const res = await postApply({ creator_id: "creator-1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown preset_slug", async () => {
    const res = await postApply({ creator_id: "creator-1", preset_slug: "nonsense" });
    expect(res.status).toBe(400);
  });

  it("applies a preset and returns its rules", async () => {
    const res = await postApply({ creator_id: "creator-1", preset_slug: "family_safe" });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.creator_id).toBe("creator-1");
    expect(data.preset).toBe("family_safe");
    expect(data.rules.slow_mode_seconds).toBe(10);
  });

  it("persists the applied preset in the shared store", async () => {
    await postApply({ creator_id: "creator-2", preset_slug: "permissive" });
    expect(creatorPresetStore.get("creator-2")).toBe("permissive");
  });

  it("overwrites a previously applied preset", async () => {
    await postApply({ creator_id: "creator-3", preset_slug: "strict" });
    await postApply({ creator_id: "creator-3", preset_slug: "permissive" });
    expect(creatorPresetStore.get("creator-3")).toBe("permissive");
  });
});
