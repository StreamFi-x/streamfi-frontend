import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPLETION_THRESHOLD = 0.95;

export interface PositionRecord {
  viewer_id: string;
  vod_id: string;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  saved_at: string;
}

export const store: Record<string, PositionRecord> = {};

const postSchema = z.object({
  viewer_id: z.string().min(1),
  vod_id: z.string().min(1),
  position_seconds: z.number().nonnegative(),
  duration_seconds: z.number().positive(),
});

const getSchema = z.object({
  viewer_id: z.string().min(1),
  vod_id: z.string().min(1),
});

/**
 * POST /api/routes-f/resume-position
 * Save a viewer's playback position on a VOD
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

  const { viewer_id, vod_id, position_seconds, duration_seconds } = parsed.data;
  const completed = position_seconds / duration_seconds >= COMPLETION_THRESHOLD;

  store[`${viewer_id}:${vod_id}`] = { viewer_id, vod_id, position_seconds, duration_seconds, completed, saved_at: new Date().toISOString() };

  return NextResponse.json({ saved: true });
}

/**
 * GET /api/routes-f/resume-position?viewer_id=...&vod_id=...
 * Return the viewer's last position and completion status
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = getSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "viewer_id and vod_id are required" }, { status: 400 });
  }

  const { viewer_id, vod_id } = parsed.data;
  const entry = store[`${viewer_id}:${vod_id}`];

  if (!entry) {
    return NextResponse.json({ position_seconds: 0, completed: false });
  }

  return NextResponse.json({ position_seconds: entry.position_seconds, completed: entry.completed });
}
