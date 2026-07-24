import { NextRequest, NextResponse } from "next/server";

export interface SeedClip {
  clip_id: string;
  creator_id: string;
  title: string;
  duration_seconds: number;
}

// Seed clips with varied durations, bundled per the routes-f scope constraint
export const SEED_CLIPS: SeedClip[] = [
  { clip_id: "clip-1", creator_id: "creator-1", title: "Insane clutch round", duration_seconds: 12 },
  { clip_id: "clip-2", creator_id: "creator-1", title: "Boss fight highlight", duration_seconds: 45 },
  { clip_id: "clip-3", creator_id: "creator-1", title: "Full raid recap", duration_seconds: 180 },
  { clip_id: "clip-4", creator_id: "creator-2", title: "Funny chat moment", duration_seconds: 8 },
  { clip_id: "clip-5", creator_id: "creator-2", title: "Speedrun world record", duration_seconds: 95 },
  { clip_id: "clip-6", creator_id: "creator-2", title: "XLM tip rain reaction", duration_seconds: 30 },
  { clip_id: "clip-7", creator_id: "creator-3", title: "Tutorial: wallet setup", duration_seconds: 240 },
  { clip_id: "clip-8", creator_id: "creator-3", title: "Stream intro", duration_seconds: 15 },
];

const DEFAULT_LIMIT = 20;

function parseNonNegativeNumber(value: string): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  const minParam = searchParams.get("min_seconds");
  const maxParam = searchParams.get("max_seconds");
  const limitParam = searchParams.get("limit");

  let minSeconds: number | null = null;
  if (minParam !== null) {
    minSeconds = parseNonNegativeNumber(minParam);
    if (minSeconds === null) {
      return NextResponse.json(
        { error: "min_seconds must be a non-negative number" },
        { status: 400 }
      );
    }
  }

  let maxSeconds: number | null = null;
  if (maxParam !== null) {
    maxSeconds = parseNonNegativeNumber(maxParam);
    if (maxSeconds === null) {
      return NextResponse.json(
        { error: "max_seconds must be a non-negative number" },
        { status: 400 }
      );
    }
  }

  if (minSeconds !== null && maxSeconds !== null && minSeconds > maxSeconds) {
    return NextResponse.json(
      { error: "min_seconds cannot be greater than max_seconds" },
      { status: 400 }
    );
  }

  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: "limit must be an integer between 1 and 100" },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  const clips = SEED_CLIPS.filter((clip) => {
    if (creatorId !== null && clip.creator_id !== creatorId) return false;
    if (minSeconds !== null && clip.duration_seconds < minSeconds) return false;
    if (maxSeconds !== null && clip.duration_seconds > maxSeconds) return false;
    return true;
  })
    .sort((a, b) => a.duration_seconds - b.duration_seconds)
    .slice(0, limit);

  return NextResponse.json({ clips, total: clips.length });
}
