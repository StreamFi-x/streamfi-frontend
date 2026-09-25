import { NextRequest, NextResponse } from "next/server";

export interface HourlySample {
  hour_offset: number;
  views_this_hour: number;
}

// Seed hourly-view samples per clip, bundled per the routes-f scope constraint.
export const SEED_HOURLY_VIEWS: Record<string, HourlySample[]> = {
  "clip-1": [
    { hour_offset: 0, views_this_hour: 120 },
    { hour_offset: 1, views_this_hour: 80 },
    { hour_offset: 2, views_this_hour: 45 },
    { hour_offset: 3, views_this_hour: 30 },
  ],
  "clip-2": [
    { hour_offset: 0, views_this_hour: 500 },
    { hour_offset: 1, views_this_hour: 320 },
    { hour_offset: 2, views_this_hour: 200 },
    { hour_offset: 3, views_this_hour: 150 },
    { hour_offset: 4, views_this_hour: 90 },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  const samples = SEED_HOURLY_VIEWS[clipId];
  if (!samples) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  let cumulative = 0;
  const series = samples
    .slice()
    .sort((a, b) => a.hour_offset - b.hour_offset)
    .map((sample) => {
      cumulative += sample.views_this_hour;
      return {
        hour_offset: sample.hour_offset,
        views_cumulative: cumulative,
        views_this_hour: sample.views_this_hour,
      };
    });

  return NextResponse.json({ series });
}
