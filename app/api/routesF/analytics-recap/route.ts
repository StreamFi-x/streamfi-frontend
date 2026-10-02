import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type RecapStats = {
  total_streams: number;
  total_hours_streamed: number;
  new_subscribers: number;
  total_tips_usdc: number;
  peak_viewers: number;
};

type RecapResponse = {
  title: string;
  highlights: string[];
  stats: RecapStats;
};

const querySchema = z.object({
  creator_id: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format"),
});

type MonthlyRecapRecord = {
  creator_name: string;
  stats: RecapStats;
  highlights: string[];
};

// Seed monthly stats bundled inside the folder (scope constraint):
// key = `${creator_id}:${month}`.
const SEED_RECAPS: Record<string, MonthlyRecapRecord> = {
  "creator-1:2024-06": {
    creator_name: "NovaStreams",
    stats: {
      total_streams: 18,
      total_hours_streamed: 62,
      new_subscribers: 340,
      total_tips_usdc: 1250.5,
      peak_viewers: 2100,
    },
    highlights: [
      "Hit a new peak of 2,100 concurrent viewers",
      "Gained 340 new subscribers this month",
      "Streamed for 62 hours across 18 sessions",
    ],
  },
  "creator-2:2024-06": {
    creator_name: "PixelPatch",
    stats: {
      total_streams: 9,
      total_hours_streamed: 27,
      new_subscribers: 45,
      total_tips_usdc: 210,
      peak_viewers: 380,
    },
    highlights: [
      "Grew subscribers by 45 this month",
      "Averaged 3 hours per stream session",
    ],
  },
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<RecapResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    creator_id: searchParams.get("creator_id") ?? undefined,
    month: searchParams.get("month") ?? undefined,
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid query parameters" },
      { status: 400 }
    );
  }

  const { creator_id, month } = validation.data;
  const record = SEED_RECAPS[`${creator_id}:${month}`];

  if (!record) {
    return NextResponse.json({ error: "No recap found for this creator and month" }, { status: 404 });
  }

  return NextResponse.json({
    title: `${record.creator_name}'s ${month} Recap`,
    highlights: record.highlights,
    stats: record.stats,
  });
}
