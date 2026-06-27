import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface QualitySelection {
  viewer_id: string;
  playback_id: string;
  label: string;
  resolution: string;
  stored_at: string;
}

const QUALITY_RESOLUTIONS: Record<string, string> = {
  "1080p": "1920x1080",
  "720p": "1280x720",
  "480p": "854x480",
  "360p": "640x360",
  "160p": "284x160",
  auto: "adaptive",
};

export const store: Record<string, QualitySelection> = {};

const postSchema = z.object({
  viewer_id: z.string().min(1),
  playback_id: z.string().min(1),
  quality_label: z.string().min(1),
});

const getSchema = z.object({
  viewer_id: z.string().min(1),
});

/**
 * POST /api/routes-f/playback-source
 * Record a viewer's manual quality selection
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { viewer_id, playback_id, quality_label } = parsed.data;
  const resolution = QUALITY_RESOLUTIONS[quality_label] ?? "unknown";

  store[viewer_id] = { viewer_id, playback_id, label: quality_label, resolution, stored_at: new Date().toISOString() };

  return NextResponse.json({ stored: true });
}

/**
 * GET /api/routes-f/playback-source?viewer_id=...
 * Return the viewer's last quality selection
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = getSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  const entry = store[parsed.data.viewer_id];
  if (!entry) {
    return NextResponse.json({ last_quality: null });
  }

  return NextResponse.json({ last_quality: { label: entry.label, resolution: entry.resolution } });
}
