/**
 * GET /api/routes-f/explore?viewer_id=
 *
 * Returns a personalized explore feed with sections:
 * - "For You" (live streams)
 * - "Continue Watching" (vods)
 * - "Clips You Might Like"
 * - "New Creators"
 *
 * Cold-start viewers (no history) receive top-N entries from seed data.
 * Viewers with history get "For You" personalized by tag overlap.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import {
  LIVE_STREAMS,
  VODS,
  CLIPS,
  CREATORS,
  VIEWER_HISTORY,
} from "./_seed";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TOP_N = 5;

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const getQuerySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function tagOverlap(itemTags: string[], viewerTags: string[]): number {
  const viewerSet = new Set(viewerTags);
  return itemTags.filter((t) => viewerSet.has(t)).length;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { viewer_id } = queryResult.data;
  const history = VIEWER_HISTORY.get(viewer_id);

  // "For You" — personalized if history exists, otherwise top by viewers_now
  const forYouItems = history
    ? [...LIVE_STREAMS]
        .sort(
          (a, b) =>
            tagOverlap(b.tags, history.watched_tags) -
            tagOverlap(a.tags, history.watched_tags)
        )
        .slice(0, TOP_N)
        .map(({ stream_id, creator_id, title, tags, viewers_now }) => ({
          stream_id,
          creator_id,
          title,
          tags,
          viewers_now,
        }))
    : [...LIVE_STREAMS]
        .sort((a, b) => b.viewers_now - a.viewers_now)
        .slice(0, TOP_N)
        .map(({ stream_id, creator_id, title, tags, viewers_now }) => ({
          stream_id,
          creator_id,
          title,
          tags,
          viewers_now,
        }));

  // "Continue Watching" — personalized by watched_creators, else top by views
  const continueWatchingItems = history
    ? [...VODS]
        .sort((a, b) => {
          const aWatched = history.watched_creators.includes(a.creator_id)
            ? 1
            : 0;
          const bWatched = history.watched_creators.includes(b.creator_id)
            ? 1
            : 0;
          if (bWatched !== aWatched) return bWatched - aWatched;
          return b.views - a.views;
        })
        .slice(0, TOP_N)
        .map(({ vod_id, creator_id, title, tags, views }) => ({
          vod_id,
          creator_id,
          title,
          tags,
          views,
        }))
    : [...VODS]
        .sort((a, b) => b.views - a.views)
        .slice(0, TOP_N)
        .map(({ vod_id, creator_id, title, tags, views }) => ({
          vod_id,
          creator_id,
          title,
          tags,
          views,
        }));

  // "Clips You Might Like" — personalized by tag overlap, else top by likes
  const clipsItems = history
    ? [...CLIPS]
        .sort(
          (a, b) =>
            tagOverlap(b.tags, history.watched_tags) -
            tagOverlap(a.tags, history.watched_tags)
        )
        .slice(0, TOP_N)
        .map(({ clip_id, creator_id, title, tags, likes }) => ({
          clip_id,
          creator_id,
          title,
          tags,
          likes,
        }))
    : [...CLIPS]
        .sort((a, b) => b.likes - a.likes)
        .slice(0, TOP_N)
        .map(({ clip_id, creator_id, title, tags, likes }) => ({
          clip_id,
          creator_id,
          title,
          tags,
          likes,
        }));

  // "New Creators" — always sorted by newest (joined_days_ago asc)
  const newCreatorsItems = [...CREATORS]
    .sort((a, b) => a.joined_days_ago - b.joined_days_ago)
    .slice(0, TOP_N)
    .map(({ creator_id, display_name, tags, followers, joined_days_ago }) => ({
      creator_id,
      display_name,
      tags,
      followers,
      joined_days_ago,
    }));

  const sections = [
    { title: "For You", items: forYouItems },
    { title: "Continue Watching", items: continueWatchingItems },
    { title: "Clips You Might Like", items: clipsItems },
    { title: "New Creators", items: newCreatorsItems },
  ];

  return NextResponse.json({ sections });
}
