import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type DropOff = {
  minute_offset: number;
  drop_count: number;
  percent_from_peak: number;
};

type DropOffResponse = {
  drop_offs: DropOff[];
};

const TOP_N = 5;

const querySchema = z.object({
  stream_id: z.string().min(1),
});

type ViewerSample = {
  minute_offset: number;
  viewer_count: number;
};

// Seed viewer-count samples bundled inside the folder (scope constraint):
// stream_id -> per-minute viewer counts.
const VIEWER_SAMPLES: Record<string, ViewerSample[]> = {
  "stream-1": [
    { minute_offset: 0, viewer_count: 500 },
    { minute_offset: 5, viewer_count: 800 },
    { minute_offset: 10, viewer_count: 1200 },
    { minute_offset: 15, viewer_count: 1150 },
    { minute_offset: 20, viewer_count: 700 }, // big drop after peak at 10
    { minute_offset: 25, viewer_count: 690 },
    { minute_offset: 30, viewer_count: 400 }, // second big drop
    { minute_offset: 35, viewer_count: 390 },
    { minute_offset: 40, viewer_count: 380 },
  ],
  "stream-2": [
    { minute_offset: 0, viewer_count: 100 },
    { minute_offset: 10, viewer_count: 150 },
    { minute_offset: 20, viewer_count: 140 },
    { minute_offset: 30, viewer_count: 145 },
  ],
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<DropOffResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    stream_id: searchParams.get("stream_id") ?? undefined,
  });

  if (!validation.success) {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  const { stream_id } = validation.data;
  const samples = VIEWER_SAMPLES[stream_id];

  if (!samples) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  const sorted = [...samples].sort((a, b) => a.minute_offset - b.minute_offset);
  const peak = sorted.reduce((max, s) => Math.max(max, s.viewer_count), 0);

  const drops: DropOff[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const dropCount = prev.viewer_count - curr.viewer_count;
    if (dropCount > 0) {
      drops.push({
        minute_offset: curr.minute_offset,
        drop_count: dropCount,
        percent_from_peak: peak > 0 ? Math.round((dropCount / peak) * 1000) / 10 : 0,
      });
    }
  }

  const drop_offs = drops
    .sort((a, b) => b.drop_count - a.drop_count)
    .slice(0, TOP_N);

  return NextResponse.json({ drop_offs });
}
