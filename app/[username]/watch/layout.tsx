import type { Metadata } from "next";
import { sql } from "@vercel/postgres";
import React from "react";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://streamfi.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

  let streamTitle = `${username} is live`;
  let playbackId: string | null = null;

  try {
    const { rows } = await sql`
      SELECT mux_playback_id, stream_title
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;
    if (rows[0]) {
      streamTitle = rows[0].stream_title || streamTitle;
      playbackId = rows[0].mux_playback_id;
    }
  } catch {
    // fallback to defaults
  }

  const title = `${streamTitle} — ${username} is live on StreamFi`;
  const canonical = `${BASE}/${username}/watch`;
  const ogImage = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
    : `${BASE}/Images/streamFi.png`;

  return {
    title,
    description: `Watch ${username} stream live on StreamFi`,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: `Watch ${username} stream live on StreamFi`,
      url: canonical,
      images: [{ url: ogImage, width: 1280, height: 720, alt: title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: `Watch ${username} stream live on StreamFi`,
      images: [ogImage],
    },
  };
}

export default function WatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
