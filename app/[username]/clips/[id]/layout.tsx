import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sql } from "@vercel/postgres";
import { unstable_cache } from "next/cache";
import { safeJsonLd } from "@/lib/security/json-ld";

const BASE = "https://www.streamfi.media";

interface Props {
  children: ReactNode;
  params: Promise<{ username: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, id } = await params;

  try {
    const { rows } = await sql`
      SELECT r.playback_id, r.title, u.avatar, u.bio
      FROM stream_recordings r
      JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
      WHERE r.id = ${id} AND r.status = 'ready'
      LIMIT 1
    `;
    const rec = rows[0];
    if (!rec) {
      return { title: `${username} – StreamFi` };
    }

    const recTitle: string = rec.title ?? `${username}'s Past Stream`;
    const description: string =
      rec.bio?.trim() || `Watch ${username}'s past stream on StreamFi.`;
    const pageUrl = `${BASE}/${username}/clips/${id}`;

    // Use Mux thumbnail as the OG image — real video frame, best for sharing
    const thumbUrl = `https://image.mux.com/${rec.playback_id}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`;

    const images = [{ url: thumbUrl, width: 1280, height: 720, alt: recTitle }];

    return {
      title: `${recTitle} – ${username} | StreamFi`,
      description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title: `${recTitle} – ${username}`,
        description,
        url: pageUrl,
        type: "video.other",
        images,
      },
      twitter: {
        card: "summary_large_image",
        title: `${recTitle} – ${username}`,
        description,
        images: [thumbUrl],
      },
    };
  } catch {
    return { title: `${username} – StreamFi` };
  }
}

type ClipRow = {
  playback_id: string;
  title: string | null;
  bio: string | null;
  duration: number | null;
  created_at: string;
};

const fetchClip = (id: string): Promise<ClipRow | null> =>
  unstable_cache(
    async (): Promise<ClipRow | null> => {
      try {
        const { rows } = await sql`
          SELECT r.playback_id, r.title, u.bio, r.duration, r.created_at
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          WHERE r.id = ${id} AND r.status = 'ready'
          LIMIT 1
        `;
        return (rows[0] as ClipRow) ?? null;
      } catch {
        return null;
      }
    },
    ["clip-layout", id],
    { revalidate: 3600 }
  )();

export default async function ClipLayout({ children, params }: Props) {
  const { username, id } = await params;
  const rec = await fetchClip(id);

  const videoSchema = rec
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: rec.title ?? `${username}'s Past Stream`,
        description:
          rec.bio?.trim() || `Watch ${username}'s past stream on StreamFi.`,
        thumbnailUrl: `https://image.mux.com/${rec.playback_id}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`,
        contentUrl: `https://stream.mux.com/${rec.playback_id}.m3u8`,
        uploadDate: rec.created_at,
        ...(rec.duration ? { duration: `PT${Math.round(rec.duration)}S` } : {}),
        url: `${BASE}/${username}/clips/${id}`,
      }
    : null;

  return (
    <>
      {videoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(videoSchema) }}
        />
      )}
      {children}
    </>
  );
}
