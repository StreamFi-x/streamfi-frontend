import { NextRequest, NextResponse } from "next/server";

export type ClipMetadata = {
  id: string;
  title: string;
  thumbnail_url: string;
  creator: string;
  duration_seconds: number;
  oembed_compatible_json: {
    type: "video";
    version: "1.0";
    title: string;
    provider_name: "StreamFi";
    provider_url: string;
    author_name: string;
    thumbnail_url: string;
    thumbnail_width: number;
    thumbnail_height: number;
    html: string;
    width: number;
    height: number;
  };
};

export const SEED_CLIPS: Record<string, ClipMetadata> = {
  "clip-1": {
    id: "clip-1",
    title: "Epic Boss Fight",
    thumbnail_url: "https://example.com/thumb1.jpg",
    creator: "GamerBob",
    duration_seconds: 45,
    oembed_compatible_json: {
      type: "video",
      version: "1.0",
      title: "Epic Boss Fight",
      provider_name: "StreamFi",
      provider_url: "https://streamfi.example",
      author_name: "GamerBob",
      thumbnail_url: "https://example.com/thumb1.jpg",
      thumbnail_width: 1280,
      thumbnail_height: 720,
      html: `<iframe src="https://streamfi.example/embed/clip-1" width="1280" height="720" frameborder="0" allowfullscreen></iframe>`,
      width: 1280,
      height: 720,
    },
  },
  "clip-2": {
    id: "clip-2",
    title: "Funny Glitch",
    thumbnail_url: "https://example.com/thumb2.jpg",
    creator: "LaughsAlot",
    duration_seconds: 15,
    oembed_compatible_json: {
      type: "video",
      version: "1.0",
      title: "Funny Glitch",
      provider_name: "StreamFi",
      provider_url: "https://streamfi.example",
      author_name: "LaughsAlot",
      thumbnail_url: "https://example.com/thumb2.jpg",
      thumbnail_width: 1280,
      thumbnail_height: 720,
      html: `<iframe src="https://streamfi.example/embed/clip-2" width="1280" height="720" frameborder="0" allowfullscreen></iframe>`,
      width: 1280,
      height: 720,
    },
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  const clip = SEED_CLIPS[clipId];
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  return NextResponse.json({
    title: clip.title,
    thumbnail_url: clip.thumbnail_url,
    creator: clip.creator,
    duration_seconds: clip.duration_seconds,
    oembed_compatible_json: clip.oembed_compatible_json,
  });
}
