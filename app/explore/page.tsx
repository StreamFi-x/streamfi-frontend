import type { Metadata } from "next";
import { sql } from "@vercel/postgres";
import { ExploreClient } from "./ExploreClient";

export const metadata: Metadata = {
  title: "Explore Live Streams",
  description:
    "Discover live streams from creators around the world. Watch gaming, music, art, IRL and more — all on StreamFi.",
  openGraph: {
    title: "Explore Live Streams | StreamFi",
    description:
      "Discover live streams from creators around the world. Watch gaming, music, art, IRL and more — all on StreamFi.",
    url: "https://www.streamfi.media/explore",
  },
};

// Fetch live streams directly from DB — no HTTP hop, no loading flash.
export default async function Home() {
  let initialStreams: {
    id: string;
    username: string;
    avatar: string | null;
    playbackId: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    thumbnail: string | null;
    viewerCount: number;
    totalViews: number;
    isFollowing: boolean;
    streamStartedAt: string;
  }[] = [];

  try {
    const result = await sql`
      SELECT
        id,
        username,
        avatar,
        mux_playback_id,
        current_viewers,
        total_views,
        stream_started_at,
        creator
      FROM users
      WHERE is_live = true
        AND COALESCE(stream_privacy, 'public') = 'public'
      ORDER BY current_viewers DESC
    `;

    initialStreams = result.rows.map(row => {
      const creator = row.creator || {};
      return {
        id: row.id,
        username: row.username,
        avatar: row.avatar ?? null,
        playbackId: row.mux_playback_id ?? "",
        title: creator.streamTitle || "Untitled Stream",
        description: creator.description || "",
        category: creator.category || "",
        tags: creator.tags || [],
        thumbnail: creator.thumbnail ?? null,
        viewerCount: row.current_viewers || 0,
        totalViews: row.total_views || 0,
        isFollowing: false,
        streamStartedAt: row.stream_started_at,
      };
    });
  } catch (err) {
    // If DB is unavailable, render the page with empty data — client SWR will recover.
    console.warn(
      "[explore] DB unavailable on server render, SWR will recover:",
      err
    );
  }

  return <ExploreClient initialStreams={initialStreams} />;
}
