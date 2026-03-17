import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sql } from "@vercel/postgres";

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
      JOIN users u ON u.id = r.user_id
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

export default function ClipLayout({ children }: Props) {
  return <>{children}</>;
}
