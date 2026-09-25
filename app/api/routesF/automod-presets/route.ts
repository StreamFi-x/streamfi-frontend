import { NextRequest, NextResponse } from "next/server";
import { PRESET_PACKS, creatorPresetStore, findPreset } from "./store";

// GET / — list available preset packs
// GET ?creator_id — current preset and rules for a creator

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json({ presets: PRESET_PACKS });
  }

  const appliedSlug = creatorPresetStore.get(creatorId);
  if (!appliedSlug) {
    return NextResponse.json({ creator_id: creatorId, preset: null, rules: null });
  }

  const preset = findPreset(appliedSlug);
  return NextResponse.json({
    creator_id: creatorId,
    preset: preset?.slug ?? null,
    rules: preset?.rules ?? null,
  });
}
