import { NextRequest, NextResponse } from "next/server";

type SeedClip = {
  clip_id: string;
  creator_id: string;
  title: string;
  tags: string[];
  views: number;
  duration_seconds: number;
};

const SEED_CLIPS: SeedClip[] = [
  { clip_id: "clip-001", creator_id: "creator-alpha", title: "Epic Raid Highlight", tags: ["gaming", "raid", "epic"], views: 8200, duration_seconds: 120 },
  { clip_id: "clip-002", creator_id: "creator-alpha", title: "Funny Fail Moment", tags: ["gaming", "funny", "fail"], views: 5400, duration_seconds: 45 },
  { clip_id: "clip-003", creator_id: "creator-beta", title: "Stellar Speed Run", tags: ["gaming", "speedrun", "epic"], views: 12000, duration_seconds: 300 },
  { clip_id: "clip-004", creator_id: "creator-beta", title: "Chat Reacts Live", tags: ["live", "chat", "funny"], views: 3100, duration_seconds: 60 },
  { clip_id: "clip-005", creator_id: "creator-gamma", title: "PvP Montage", tags: ["gaming", "pvp", "epic"], views: 7600, duration_seconds: 180 },
  { clip_id: "clip-006", creator_id: "creator-gamma", title: "Relaxed Mining Stream", tags: ["chill", "mining", "live"], views: 1800, duration_seconds: 600 },
  { clip_id: "clip-007", creator_id: "creator-alpha", title: "Boss Kill WR", tags: ["gaming", "raid", "speedrun", "epic"], views: 15000, duration_seconds: 90 },
  { clip_id: "clip-008", creator_id: "creator-delta", title: "Art Speed Draw", tags: ["art", "timelapse", "chill"], views: 4200, duration_seconds: 240 },
  { clip_id: "clip-009", creator_id: "creator-delta", title: "Stream Highlights Pack", tags: ["live", "funny", "gaming"], views: 6300, duration_seconds: 360 },
  { clip_id: "clip-010", creator_id: "creator-gamma", title: "Rare Drop Reaction", tags: ["gaming", "raid", "funny"], views: 9100, duration_seconds: 55 },
];

function jaccardScore(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 && tagsB.length === 0) {return 1;}
  const setA = new Set(tagsA);
  const setB = new Set(tagsB);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

const SAME_CREATOR_BONUS = 0.2;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");
  if (!clipId || !clipId.trim()) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_LIMIT}` },
        { status: 400 },
      );
    }
    limit = parsed;
  }

  const target = SEED_CLIPS.find((c) => c.clip_id === clipId.trim());
  if (!target) {
    return NextResponse.json({ clip_id: clipId, related: [] });
  }

  const scored = SEED_CLIPS.filter((c) => c.clip_id !== target.clip_id).map((c) => {
    const tagScore = jaccardScore(target.tags, c.tags);
    const creatorBonus = c.creator_id === target.creator_id ? SAME_CREATOR_BONUS : 0;
    const similarity_score = Math.min(1, Math.round((tagScore + creatorBonus) * 100) / 100);
    return { clip: c, similarity_score };
  });

  scored.sort((a, b) => b.similarity_score - a.similarity_score || b.clip.views - a.clip.views);

  return NextResponse.json({
    clip_id: target.clip_id,
    related: scored.slice(0, limit),
  });
}
