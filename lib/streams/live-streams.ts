import { sql } from "@vercel/postgres";

export const LIVE_STREAMS_PAGE_SIZE = 50;

export interface LiveStreamItem {
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
  streamStartedAt: unknown;
}

export interface LiveStreamsPage {
  streams: LiveStreamItem[];
  hasMore: boolean;
  nextOffset: number | null;
}

export async function fetchLiveStreams(options: {
  viewerWallet?: string | null;
  offset?: number;
}): Promise<LiveStreamsPage> {
  const viewerWallet = options.viewerWallet ?? null;
  const offset = Math.max(0, options.offset ?? 0);

  // When personalising (following-first JS sort), fetch 2x the page so
  // followed streams with lower viewer counts still make page 1.
  const fetchLimit = viewerWallet
    ? LIVE_STREAMS_PAGE_SIZE * 2
    : LIVE_STREAMS_PAGE_SIZE;

  const liveStreamsResult = await sql`
    SELECT
      id, username, avatar,
      mux_playback_id,
      current_viewers, total_views,
      stream_started_at, creator
    FROM users
    WHERE is_live = true
      AND deleted_at IS NULL
      AND COALESCE(stream_privacy, 'public') = 'public'
    ORDER BY current_viewers DESC
    LIMIT ${fetchLimit} OFFSET ${offset}
  `;

  if (liveStreamsResult.rows.length === 0) {
    return { streams: [], hasMore: false, nextOffset: null };
  }

  let viewerFollowing: string[] = [];
  if (viewerWallet) {
    const { rows: followRows } = await sql`
      SELECT uf.followee_id
      FROM   user_follows uf
      JOIN   users v ON v.id = uf.follower_id AND v.deleted_at IS NULL
      WHERE  LOWER(v.wallet) = LOWER(${viewerWallet})
    `;
    viewerFollowing = followRows.map(r => r.followee_id as string);
  }

  const streams: LiveStreamItem[] = liveStreamsResult.rows.map(row => {
    const creator = (row.creator || {}) as Record<string, unknown>;
    return {
      id: String(row.id),
      username: String(row.username),
      avatar: (row.avatar as string | null) ?? null,
      playbackId: (row.mux_playback_id as string | null) ?? "",
      title:
        typeof creator.streamTitle === "string" && creator.streamTitle
          ? creator.streamTitle
          : "Untitled Stream",
      description:
        typeof creator.description === "string" ? creator.description : "",
      category: typeof creator.category === "string" ? creator.category : "",
      tags: Array.isArray(creator.tags) ? (creator.tags as string[]) : [],
      thumbnail:
        typeof creator.thumbnail === "string" ? creator.thumbnail : null,
      viewerCount: Number(row.current_viewers || 0),
      totalViews: Number(row.total_views || 0),
      isFollowing: viewerFollowing.includes(row.id),
      streamStartedAt: row.stream_started_at,
    };
  });

  if (viewerWallet) {
    streams.sort((a, b) => {
      if (a.isFollowing !== b.isFollowing) {
        return a.isFollowing ? -1 : 1;
      }
      return b.viewerCount - a.viewerCount;
    });
  }

  const page = streams.slice(0, LIVE_STREAMS_PAGE_SIZE);
  const hasMore = liveStreamsResult.rows.length === fetchLimit;
  const nextOffset = hasMore ? offset + LIVE_STREAMS_PAGE_SIZE : null;

  return { streams: page, hasMore, nextOffset };
}
