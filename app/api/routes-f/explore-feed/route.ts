/**
 * GET  /api/routes-f/explore-feed?viewer_id=
 *
 * Returns a personalized explore feed mixing live streams, VODs, clips, and
 * new creators. Seed data is bundled inline. A cold-start viewer (no history)
 * gets a generic trending feed.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const LIVE_STREAMS = [
  { id: "ls-001", creator_id: "c-001", creator_name: "CryptoKing", title: "Stellar DeFi Deep Dive", viewers_now: 1420 },
  { id: "ls-002", creator_id: "c-002", creator_name: "ArtByLena", title: "Live Generative Art", viewers_now: 830 },
  { id: "ls-003", creator_id: "c-003", creator_name: "GamingGuru", title: "Speedrun Saturday", viewers_now: 3200 },
  { id: "ls-004", creator_id: "c-004", creator_name: "MusicMaven", title: "Lo-fi Coding Session", viewers_now: 560 },
];

const VODS = [
  { id: "vod-001", creator_id: "c-001", title: "Intro to Stellar AMMs", duration_s: 1800, progress_pct: 0 },
  { id: "vod-002", creator_id: "c-003", title: "Top 10 Speedrun Fails", duration_s: 900, progress_pct: 0 },
  { id: "vod-003", creator_id: "c-005", creator_name: "DevDojo", title: "Smart Contracts 101", duration_s: 3600, progress_pct: 0 },
];

const CLIPS = [
  { id: "clip-001", creator_id: "c-002", title: "Pixel-perfect generative circle", duration_s: 45 },
  { id: "clip-002", creator_id: "c-003", title: "World-record split", duration_s: 30 },
  { id: "clip-003", creator_id: "c-004", title: "Chillest lofi drop ever", duration_s: 60 },
];

const NEW_CREATORS = [
  { id: "c-010", name: "StellarSam", followers: 12, streams_count: 3, category: "Finance" },
  { id: "c-011", name: "PixelPaula", followers: 8, streams_count: 1, category: "Art" },
  { id: "c-012", name: "CodeWithKai", followers: 20, streams_count: 5, category: "Dev" },
];

// viewer_id → set of creator_ids the viewer has watched
const VIEWER_HISTORY: Record<string, string[]> = {
  "v-rich-001": ["c-001", "c-002", "c-003"],
  "v-rich-002": ["c-003", "c-004"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function personalizedLive(viewerHistory: string[]) {
  if (!viewerHistory.length) return LIVE_STREAMS.slice(0, 3);
  const preferred = LIVE_STREAMS.filter((s) => viewerHistory.includes(s.creator_id));
  const rest = LIVE_STREAMS.filter((s) => !viewerHistory.includes(s.creator_id));
  return [...preferred, ...rest].slice(0, 3);
}

function continueWatching(viewerHistory: string[]) {
  return VODS.filter((v) => viewerHistory.includes(v.creator_id)).map((v) => ({
    ...v,
    // Simulate partial progress for known creators.
    progress_pct: 42,
  }));
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const querySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const result = validateQuery(searchParams, querySchema);
  if (result instanceof NextResponse) return result;

  const { viewer_id } = result.data;
  const history = VIEWER_HISTORY[viewer_id] ?? [];
  const isColdStart = history.length === 0;

  const sections = [
    {
      title: "For You",
      items: personalizedLive(history),
    },
    {
      title: "Continue Watching",
      items: isColdStart ? [] : continueWatching(history),
    },
    {
      title: "Clips You Might Like",
      items: isColdStart
        ? CLIPS
        : CLIPS.filter((c) => history.includes(c.creator_id)).concat(
            CLIPS.filter((c) => !history.includes(c.creator_id))
          ),
    },
    {
      title: "New Creators",
      items: NEW_CREATORS,
    },
  ];

  return NextResponse.json({ sections });
}
