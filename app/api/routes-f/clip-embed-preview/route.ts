import { NextRequest, NextResponse } from "next/server";

export interface SeedClip {
  clip_id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
  privacy: "public" | "unlisted" | "subscribers-only";
}

// Seed clips bundled per the routes-f scope constraint.
export const SEED_CLIPS: SeedClip[] = [
  {
    clip_id: "clip-1",
    creator_id: "creator-1",
    creator_name: "NovaStreams",
    title: "Insane clutch round",
    thumbnail_url: "https://cdn.streamfi.example/clips/clip-1/thumb.jpg",
    duration_seconds: 12,
    privacy: "public",
  },
  {
    clip_id: "clip-2",
    creator_id: "creator-2",
    creator_name: "PixelPatch",
    title: "Speedrun world record",
    thumbnail_url: "https://cdn.streamfi.example/clips/clip-2/thumb.jpg",
    duration_seconds: 95,
    privacy: "public",
  },
  {
    clip_id: "clip-3",
    creator_id: "creator-3",
    creator_name: "WalletWiz",
    title: "Tutorial: wallet setup",
    thumbnail_url: "https://cdn.streamfi.example/clips/clip-3/thumb.jpg",
    duration_seconds: 240,
    privacy: "subscribers-only",
  },
];

const CLIP_BASE_URL = "https://streamfi.example/clips";

function findClip(clipId: string): SeedClip | undefined {
  return SEED_CLIPS.find((clip) => clip.clip_id === clipId);
}

function buildOembedHtml(clip: SeedClip): string {
  const clipUrl = `${CLIP_BASE_URL}/${clip.clip_id}`;
  return `<iframe src="${clipUrl}/embed" width="600" height="338" frameborder="0" allowfullscreen title="${clip.title}"></iframe>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  const clip = findClip(clipId);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (clip.privacy === "subscribers-only") {
    return NextResponse.json(
      { error: "This clip is not available for public embedding" },
      { status: 403 }
    );
  }

  const clipUrl = `${CLIP_BASE_URL}/${clip.clip_id}`;

  return NextResponse.json({
    type: "video",
    version: "1.0",
    title: clip.title,
    author_name: clip.creator_name,
    author_url: `https://streamfi.example/${clip.creator_id}`,
    provider_name: "StreamFi",
    provider_url: "https://streamfi.example",
    thumbnail_url: clip.thumbnail_url,
    thumbnail_width: 1280,
    thumbnail_height: 720,
    html: buildOembedHtml(clip),
    width: 600,
    height: 338,
    // Twitter/Discord card hints, alongside the standard oEmbed shape above.
    twitter_card: "player",
    twitter_title: clip.title,
    twitter_image: clip.thumbnail_url,
    twitter_player: `${clipUrl}/embed`,
    twitter_player_width: 600,
    twitter_player_height: 338,
  });
}
