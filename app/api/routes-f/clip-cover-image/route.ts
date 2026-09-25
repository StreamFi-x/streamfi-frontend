/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";

// In-memory store for custom cover images: clip_id -> cover_url
export const CLIP_COVERS: Record<string, string> = {};

// Fallback auto-generated thumbnail (what Mux would produce for the clip)
function autoThumbnailUrl(clipId: string): string {
  return `https://image.mux.com/${clipId}/thumbnail.jpg`;
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { clip_id, cover_url } = body;

    if (!clip_id || typeof clip_id !== "string") {
      return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
    }
    if (!cover_url || typeof cover_url !== "string") {
      return NextResponse.json({ error: "cover_url is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(cover_url);
    } catch {
      return NextResponse.json({ error: "cover_url is not a valid URL" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "cover_url must use http or https" },
        { status: 400 }
      );
    }

    CLIP_COVERS[clip_id] = cover_url;

    return NextResponse.json({ clip_id, cover_url, custom: true });
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  const custom = clipId in CLIP_COVERS;
  const coverUrl = custom ? CLIP_COVERS[clipId] : autoThumbnailUrl(clipId);

  return NextResponse.json({ cover_url: coverUrl, custom });
}
