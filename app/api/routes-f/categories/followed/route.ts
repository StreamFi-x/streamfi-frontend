import { NextRequest, NextResponse } from "next/server";

export interface Stream {
  creator: string;
  category: string;
  viewer_count: number;
}

// Seed category follows mapping: viewer_id -> list of followed categories
export const SEED_FOLLOWS: Record<string, string[]> = {
  "viewer-1": ["Gaming", "Music", "Talk Shows"],
  "viewer-2": ["Gaming"],
  "viewer-3": ["Crypto", "Coding"],
};

// Seed live streams
export const SEED_STREAMS: Stream[] = [
  { creator: "creator-gaming-1", category: "Gaming", viewer_count: 1500 },
  { creator: "creator-gaming-2", category: "Gaming", viewer_count: 800 },
  { creator: "creator-music-1", category: "Music", viewer_count: 450 },
  { creator: "creator-talk-1", category: "Talk Shows", viewer_count: 1200 },
  { creator: "creator-crypto-1", category: "Crypto", viewer_count: 3100 },
  { creator: "creator-coding-1", category: "Coding", viewer_count: 950 },
  { creator: "creator-sports-1", category: "Sports", viewer_count: 5000 },
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");

  if (!viewerId) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  // Get categories followed by the viewer
  const followedCategories = SEED_FOLLOWS[viewerId] || [];

  // Filter streams to only those in the followed categories
  const followedStreams = SEED_STREAMS.filter((stream) =>
    followedCategories.includes(stream.category)
  );

  // Sort by viewer_count descending
  followedStreams.sort((a, b) => b.viewer_count - a.viewer_count);

  return NextResponse.json({
    streams: followedStreams,
  });
}
