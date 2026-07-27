import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type DecayedCreator = {
  creator: string;
  last_interaction_at: string;
  days_since: number;
};

type EngagementDecayResponse = {
  decayed_creators: DecayedCreator[];
};

// Decay rules: a creator appears in the report only when the viewer has a
// real history with them (>= MIN_INTERACTIONS past interactions) AND the
// relationship has gone quiet (gap since last interaction > DECAY_GAP_DAYS).
const MIN_INTERACTIONS = 3;
const DECAY_GAP_DAYS = 30;
const DEFAULT_WINDOW_DAYS = 90;

// Fixed reference "now" keeps the bundled seed history deterministic.
const REFERENCE_NOW = new Date("2024-07-01T00:00:00Z");

const querySchema = z.object({
  viewer_id: z.string().min(1),
  window_days: z
    .string()
    .optional()
    .default(String(DEFAULT_WINDOW_DAYS))
    .transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) || num <= 0 ? DEFAULT_WINDOW_DAYS : Math.min(num, 365);
    }),
});

type EngagementRecord = {
  creator: string;
  interactions: number;
  last_interaction_at: string;
};

// Seed engagement history bundled inside the folder (scope constraint):
// viewer_id -> per-creator interaction summaries.
const ENGAGEMENT_HISTORY: Record<string, EngagementRecord[]> = {
  v001: [
    // Heavy history, went quiet 45 days ago -> decayed.
    { creator: "StreamKing", interactions: 24, last_interaction_at: "2024-05-17T20:00:00Z" },
    // Heavy history, quiet 75 days -> decayed.
    { creator: "NightOwlGamer", interactions: 11, last_interaction_at: "2024-04-17T22:30:00Z" },
    // Only 2 past interactions -> below threshold, never reported.
    { creator: "TechTalkDaily", interactions: 2, last_interaction_at: "2024-03-01T18:00:00Z" },
    // Still active (5 days ago) -> not decayed.
    { creator: "MusicVibes", interactions: 40, last_interaction_at: "2024-06-26T19:15:00Z" },
    // Quiet for 200 days -> outside a 90-day window, inside a 365-day one.
    { creator: "ArtByNature", interactions: 8, last_interaction_at: "2023-12-14T17:00:00Z" },
  ],
  v002: [
    // Exactly the interaction threshold, quiet 31 days -> decayed.
    { creator: "CookingWithAlex", interactions: 3, last_interaction_at: "2024-05-30T12:00:00Z" },
    // Gap of exactly 30 days -> NOT decayed (rule is strictly greater).
    { creator: "FitnessFirst", interactions: 9, last_interaction_at: "2024-06-01T00:00:00Z" },
  ],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string): number {
  return Math.floor((REFERENCE_NOW.getTime() - new Date(iso).getTime()) / MS_PER_DAY);
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<EngagementDecayResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    viewer_id: searchParams.get("viewer_id") ?? undefined,
    window_days: searchParams.get("window_days") ?? undefined,
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  const { viewer_id, window_days } = validation.data;

  const decayed_creators = (ENGAGEMENT_HISTORY[viewer_id] ?? [])
    .map((rec) => ({ rec, gap: daysSince(rec.last_interaction_at) }))
    .filter(
      ({ rec, gap }) =>
        rec.interactions >= MIN_INTERACTIONS &&
        gap > DECAY_GAP_DAYS &&
        gap <= window_days
    )
    .sort((a, b) => b.gap - a.gap)
    .map(({ rec, gap }) => ({
      creator: rec.creator,
      last_interaction_at: rec.last_interaction_at,
      days_since: gap,
    }));

  return NextResponse.json({ decayed_creators });
}
