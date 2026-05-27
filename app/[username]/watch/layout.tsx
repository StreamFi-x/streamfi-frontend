import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sql } from "@vercel/postgres";
import { unstable_cache } from "next/cache";

const BASE = "https://www.streamfi.media";

interface Props {
  children: ReactNode;
  params: Promise<{ username: string }>;
}

type UserRow = {
  username: string;
  avatar: string | null;
  bio: string | null;
  is_live: boolean;
  creator: Record<string, any> | null;
  mux_playback_id: string | null;
  stream_privacy: string | null;
};

const fetchWatchUser = unstable_cache(
  async (slug: string): Promise<UserRow | null> => {
    try {
      const { rows } = await sql`
        SELECT username, avatar, bio, is_live, creator, mux_playback_id,
               stream_privacy
        FROM users
        WHERE LOWER(username) = ${slug}
        LIMIT 1
      `;
      return (rows[0] as UserRow) ?? null;
    } catch {
      return null;
    }
  },
  ["watch-page-meta"],
  { revalidate: 60 }
);

/**
 * OG / Twitter metadata for /[username]/watch — overrides the parent
 * /[username]/layout.tsx so shares of stream URLs (including private invite
 * links with ?key=...) preview the stream's thumbnail + description rather
 * than the creator's avatar + bio.
 *
 * Behavior on private (unlisted/subscribers-only) streams: metadata is still
 * shown to any visitor — same model as YouTube Unlisted. The privacy boundary
 * protects the playback, not the title/description/thumbnail.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await fetchWatchUser(username.toLowerCase());

  if (!user) {
    return { title: `${username} – StreamFi` };
  }

  const streamTitle: string =
    user.creator?.streamTitle?.trim() ||
    user.creator?.title?.trim() ||
    `${user.username}'s Live Stream`;

  const description: string =
    user.creator?.description?.trim() ||
    user.bio?.trim() ||
    `Watch ${user.username} stream live on StreamFi.`;

  // Image priority:
  //   1. Custom stream thumbnail set in stream details
  //   2. Mux live thumbnail (real video frame) when public + live
  //   3. User avatar
  //   4. Site default
  const customThumb: string | undefined = user.creator?.thumbnail;
  const isPublic = (user.stream_privacy ?? "public") === "public";
  const muxThumb =
    user.is_live && isPublic && user.mux_playback_id
      ? `https://image.mux.com/${user.mux_playback_id}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`
      : null;

  let imageUrl: string;
  let imageDims = { width: 1280, height: 720 };
  if (customThumb) {
    imageUrl = customThumb;
  } else if (muxThumb) {
    imageUrl = muxThumb;
  } else if (user.avatar) {
    imageUrl = user.avatar;
    imageDims = { width: 400, height: 400 };
  } else {
    imageUrl = `${BASE}/Images/streamFi.png`;
  }

  const liveBadge = user.is_live && isPublic ? "🔴 LIVE – " : "";
  const titleLabel = `${liveBadge}${streamTitle} – ${user.username} | StreamFi`;
  const pageUrl = `${BASE}/${user.username}/watch`;

  const images = [
    {
      url: imageUrl,
      width: imageDims.width,
      height: imageDims.height,
      alt: streamTitle,
    },
  ];

  return {
    title: titleLabel,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: titleLabel,
      description,
      url: pageUrl,
      type: "video.other",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: titleLabel,
      description,
      images: [imageUrl],
    },
  };
}

export default function WatchLayout({ children }: Props) {
  return <>{children}</>;
}
