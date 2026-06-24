/**
 * GET  /api/routes-f/raid-suggestions?from_creator_id=&limit=5
 *
 * Suggests creators to raid at end-of-stream. Must be currently live, not
 * blocked by or blocking the raider, and not the same creator. Ranked by
 * shared followers descending.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
interface LiveStream {
  creator_id: string;
  creator_name: string;
  viewers_now: number;
  category: string;
}

const LIVE_STREAMS: LiveStream[] = [
  { creator_id: "c-001", creator_name: "CryptoKing", viewers_now: 1420, category: "Finance" },
  { creator_id: "c-002", creator_name: "ArtByLena", viewers_now: 830, category: "Art" },
  { creator_id: "c-003", creator_name: "GamingGuru", viewers_now: 3200, category: "Gaming" },
  { creator_id: "c-004", creator_name: "MusicMaven", viewers_now: 560, category: "Music" },
  { creator_id: "c-005", creator_name: "DevDojo", viewers_now: 1100, category: "Dev" },
];

// follow graph: creator_id → set of follower user_ids
const FOLLOW_GRAPH: Record<string, string[]> = {
  "c-001": ["u-01", "u-02", "u-03", "u-04", "u-05"],
  "c-002": ["u-02", "u-03", "u-06", "u-07"],
  "c-003": ["u-01", "u-03", "u-04", "u-08", "u-09"],
  "c-004": ["u-04", "u-05", "u-10"],
  "c-005": ["u-01", "u-05", "u-06", "u-11"],
  "c-010": ["u-01", "u-02"],
  "c-011": [],
};

// bidirectional block list: set of "a:b" pairs (both "a:b" and "b:a" are stored)
const BLOCKS = new Set<string>(["c-003:c-010", "c-010:c-003"]);

function isBlocked(a: string, b: string): boolean {
  return BLOCKS.has(`${a}:${b}`) || BLOCKS.has(`${b}:${a}`);
}

function sharedFollowers(a: string, b: string): number {
  const setA = new Set(FOLLOW_GRAPH[a] ?? []);
  return (FOLLOW_GRAPH[b] ?? []).filter((f) => setA.has(f)).length;
}

function reason(shared: number, category: string): string {
  if (shared >= 3) return `${shared} of your followers already follow them`;
  return `Popular in ${category}`;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const querySchema = z.object({
  from_creator_id: z.string().min(1, "from_creator_id is required"),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const result = validateQuery(searchParams, querySchema);
  if (result instanceof NextResponse) return result;

  const { from_creator_id, limit } = result.data;

  const candidates = LIVE_STREAMS.filter(
    (s) => s.creator_id !== from_creator_id && !isBlocked(from_creator_id, s.creator_id)
  );

  const ranked = candidates
    .map((s) => {
      const shared = sharedFollowers(from_creator_id, s.creator_id);
      return {
        creator: { id: s.creator_id, name: s.creator_name, category: s.category },
        viewers_now: s.viewers_now,
        shared_followers: shared,
        reason: reason(shared, s.category),
      };
    })
    .sort((a, b) => b.shared_followers - a.shared_followers)
    .slice(0, limit);

  return NextResponse.json({ suggestions: ranked });
}
