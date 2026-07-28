import { NextRequest, NextResponse } from "next/server";
import { creatorPresetStore, findPreset } from "../store";

// POST /apply { creator_id, preset_slug } — sets a creator's auto-mod to the given preset

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const creatorId = typeof payload.creator_id === "string" ? payload.creator_id.trim() : null;
  const presetSlug = typeof payload.preset_slug === "string" ? payload.preset_slug : null;

  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (!presetSlug) {
    return NextResponse.json({ error: "preset_slug is required" }, { status: 400 });
  }

  const preset = findPreset(presetSlug);
  if (!preset) {
    return NextResponse.json({ error: `Unknown preset_slug: ${presetSlug}` }, { status: 400 });
  }

  creatorPresetStore.set(creatorId, preset.slug);

  return NextResponse.json({
    creator_id: creatorId,
    preset: preset.slug,
    rules: preset.rules,
  });
}
