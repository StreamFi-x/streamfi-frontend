import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Bucket = {
  range: string;
  count: number;
};

type SessionLengthResult = {
  avg_minutes: number;
  median_minutes: number;
  p90_minutes: number;
  buckets: Bucket[];
};

type ErrorResult = {
  error: string;
};

const querySchema = z.object({
  stream_id: z.string().min(1, "stream_id is required"),
});

const BUCKET_RANGES: Array<{ range: string; min: number; max: number }> = [
  { range: "0-5", min: 0, max: 5 },
  { range: "5-15", min: 5, max: 15 },
  { range: "15-30", min: 15, max: 30 },
  { range: "30-60", min: 30, max: 60 },
  { range: "60+", min: 60, max: Infinity },
];

/** Bundled seed session durations (minutes) for well-known demo streams. */
const SEED_SESSIONS: Record<string, number[]> = {
  "stream-1": [2, 4, 8, 12, 12, 18, 22, 25, 40, 45, 62, 70, 90],
  "stream-2": [1, 3, 3, 5, 6, 9, 10, 14, 20, 21, 33],
};

function seedSessionDurations(streamId: string): number[] {
  const bundled = SEED_SESSIONS[streamId];
  if (bundled) {return bundled;}

  const hash = streamId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const count = 10 + (hash % 20);
  const durations: number[] = [];
  for (let i = 0; i < count; i++) {
    durations.push(1 + ((hash * (i + 7)) % 120));
  }
  return durations;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Nearest-rank percentile over a sorted ascending array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {return 0;}
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index];
}

export async function GET(req: NextRequest): Promise<NextResponse<SessionLengthResult | ErrorResult>> {
  const { searchParams } = new URL(req.url);
  const validation = querySchema.safeParse({ stream_id: searchParams.get("stream_id") });

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid query parameters" },
      { status: 400 },
    );
  }

  const { stream_id } = validation.data;
  const durations = seedSessionDurations(stream_id);
  const sorted = [...durations].sort((x, y) => x - y);

  const avg_minutes = round2(sorted.reduce((sum, d) => sum + d, 0) / sorted.length);
  const median_minutes = round2(percentile(sorted, 50));
  const p90_minutes = round2(percentile(sorted, 90));

  const buckets: Bucket[] = BUCKET_RANGES.map(({ range, min, max }) => ({
    range,
    count: sorted.filter((d) => d >= min && d < max).length,
  }));

  return NextResponse.json({ avg_minutes, median_minutes, p90_minutes, buckets });
}
