import { NextRequest, NextResponse } from "next/server";
import { SEED_TRACKS, CaptionTrack } from "./seed-tracks";

/**
 * Closed Captions endpoint
 *
 * GET ?playback_id=...   → { tracks: [{ lang, label, url }] }
 * GET ?viewer_id=...     → { captions_enabled: boolean, preferred_lang: string | null }
 * PUT { viewer_id, captions_enabled, preferred_lang } → updated prefs
 *
 * Viewer prefs are stored in an in-memory map (no DB).
 */

interface ViewerPrefs {
  captions_enabled: boolean;
  preferred_lang: string | null;
}

// In-memory store: viewer_id → prefs
export const viewerPrefsStore = new Map<string, ViewerPrefs>();

// Build a lookup from playback_id → tracks
const tracksByPlaybackId = new Map<string, CaptionTrack[]>();
for (const entry of SEED_TRACKS) {
  tracksByPlaybackId.set(entry.playback_id, entry.tracks);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const playbackId = searchParams.get("playback_id");
  if (playbackId !== null) {
    const tracks = tracksByPlaybackId.get(playbackId) ?? [];
    return NextResponse.json({ tracks });
  }

  const viewerId = searchParams.get("viewer_id");
  if (viewerId !== null) {
    const prefs = viewerPrefsStore.get(viewerId) ?? {
      captions_enabled: false,
      preferred_lang: null,
    };
    return NextResponse.json(prefs);
  }

  return NextResponse.json(
    { error: "playback_id or viewer_id query parameter is required" },
    { status: 400 }
  );
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).viewer_id !== "string" ||
    typeof (body as Record<string, unknown>).captions_enabled !== "boolean"
  ) {
    return NextResponse.json(
      { error: "viewer_id (string) and captions_enabled (boolean) are required" },
      { status: 400 }
    );
  }

  const {
    viewer_id,
    captions_enabled,
    preferred_lang = null,
  } = body as {
    viewer_id: string;
    captions_enabled: boolean;
    preferred_lang?: string | null;
  };

  if (preferred_lang !== null && typeof preferred_lang !== "string") {
    return NextResponse.json(
      { error: "preferred_lang must be a string or null" },
      { status: 400 }
    );
  }

  const prefs: ViewerPrefs = {
    captions_enabled,
    preferred_lang: preferred_lang ?? null,
  };

  viewerPrefsStore.set(viewer_id, prefs);

  return NextResponse.json(prefs);
}
