/**
 * Followed creators feed — issue #995
 *
 * GET ?viewer_id -> { live: [...], offline_recently: [...] }
 * offline_recently = creators followed by viewer who went offline in last 24h
 */
import { NextRequest, NextResponse } from "next/server";
import { followsData, liveStreams, recentlyOfflineStreams } from "./seed";
import { FollowedFeedResponse } from "./types";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const viewer_id = new URL(req.url).searchParams.get("viewer_id");

  if (!viewer_id) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  const followed = followsData[viewer_id] ?? [];

  if (followed.length === 0) {
    return NextResponse.json<FollowedFeedResponse>(
      { live: [], offline_recently: [] },
      { status: 200 }
    );
  }

  const followedSet = new Set(followed);
  const now = Date.now();

  const live = liveStreams.filter((s) => followedSet.has(s.creator_id));

  const offline_recently = recentlyOfflineStreams.filter((s) => {
    if (!followedSet.has(s.creator_id)) return false;
    if (!s.ended_at) return false;
    return now - new Date(s.ended_at).getTime() <= TWENTY_FOUR_HOURS_MS;
  });

  return NextResponse.json<FollowedFeedResponse>({ live, offline_recently }, { status: 200 });
}
