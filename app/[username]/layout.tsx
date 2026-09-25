import React from "react";
import { sql } from "@vercel/postgres";
import { unstable_cache } from "next/cache";
import { CACHE_POLICIES, cacheTags } from "@/lib/cache";
import type { Metadata } from "next";
import UsernameLayoutClient from "./UsernameLayoutClient";

const BASE = "https://www.streamfi.media";

interface UsernameLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

type UserRow = {
  username: string;
  avatar: string | null;
  bio: string | null;
  is_live: boolean;
  creator: Record<string, string> | null;
  mux_playback_id: string | null;
  stream_started_at: string | null;
};

// unstable_cache deduplicates the DB query so generateMetadata and the layout
// render share one result per request. The TTL bounds live-status staleness;
// the per-user tag lets profile writes purge it (lib/cache/invalidation.ts).
const fetchUser = (slug: string): Promise<UserRow | null> =>
  unstable_cache(
    async (): Promise<UserRow | null> => {
      try {
        const { rows } = await sql`
          SELECT username, avatar, bio, is_live, creator, mux_playback_id, stream_started_at
          FROM users
          WHERE LOWER(username) = ${slug}
          LIMIT 1
        `;
        return (rows[0] as UserRow) ?? null;
      } catch {
        return null;
      }
    },
    ["user-profile", slug],
    {
      revalidate: CACHE_POLICIES.publicProfile.appTtlSeconds,
      tags: [cacheTags.userByName(slug)],
    }
  )();

export async function generateMetadata({
  params,
}: UsernameLayoutProps): Promise<Metadata> {
  const { username } = await params;
  const user = await fetchUser(username.toLowerCase());

  if (!user) {
    return { title: "StreamFi" };
  }

  const name = user.username;
  const bio = user.bio?.trim() || `Watch ${name} stream live on StreamFi.`;
  const streamTitle = user.creator?.streamTitle;
  const title =
    user.is_live && streamTitle
      ? `${name} is LIVE – ${streamTitle}`
      : `${name} – StreamFi`;

  const ogImage = user.avatar
    ? [{ url: user.avatar, width: 400, height: 400, alt: name }]
    : [
        {
          url: `${BASE}/Images/streamFi.png`,
          width: 1200,
          height: 630,
          alt: "StreamFi",
        },
      ];

  return {
    title,
    description: bio,
    alternates: { canonical: `${BASE}/${name}` },
    openGraph: {
      title,
      description: bio,
      url: `${BASE}/${name}`,
      type: "profile",
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: bio,
      images: ogImage.map(i => i.url),
    },
  };
}

export default async function UsernameLayout({
  children,
  params,
}: UsernameLayoutProps) {
  const { username } = await params;
  const user = await fetchUser(username.toLowerCase());

  const personSchema = user
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: user.username,
        url: `${BASE}/${user.username}`,
        ...(user.avatar ? { image: user.avatar } : {}),
        ...(user.bio ? { description: user.bio } : {}),
      }
    : null;

  const videoSchema =
    user?.is_live && user.mux_playback_id
      ? {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: user.creator?.streamTitle || `${user.username}'s Live Stream`,
          description:
            user.bio || `Watch ${user.username} stream live on StreamFi.`,
          thumbnailUrl: `https://image.mux.com/${user.mux_playback_id}/thumbnail.png?width=1280&height=720&fit_mode=crop`,
          uploadDate: user.stream_started_at ?? new Date().toISOString(),
          url: `${BASE}/${user.username}`,
        }
      : null;

  return (
    <>
      {personSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
      )}
      {videoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
        />
      )}
      <UsernameLayoutClient username={username}>
        {children}
      </UsernameLayoutClient>
    </>
  );
}
