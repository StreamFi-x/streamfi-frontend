/**
 * GET  /api/routes-f/viewer-notification-prefs?viewer_id=
 * PUT  /api/routes-f/viewer-notification-prefs
 *
 * Manages viewer-level notification preferences.
 * Uses in-memory storage — no real DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ViewerNotificationPrefs {
  viewer_id: string;
  live_alerts: boolean;
  tips_received: boolean;
  chat_mentions: boolean;
  email_digest: boolean;
}

// ---------------------------------------------------------------------------
// In-memory storage (exported for test resets)
// ---------------------------------------------------------------------------
export const prefsStore: Map<string, ViewerNotificationPrefs> = new Map();

// ---------------------------------------------------------------------------
// Default preferences
// ---------------------------------------------------------------------------
const DEFAULT_PREFS: Omit<ViewerNotificationPrefs, "viewer_id"> = {
  live_alerts: true,
  tips_received: true,
  chat_mentions: true,
  email_digest: false,
};

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const getQuerySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
});

const putBodySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  live_alerts: z.boolean().optional(),
  tips_received: z.boolean().optional(),
  chat_mentions: z.boolean().optional(),
  email_digest: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { viewer_id } = queryResult.data;
  const stored = prefsStore.get(viewer_id);

  const prefs = {
    live_alerts: stored?.live_alerts ?? DEFAULT_PREFS.live_alerts,
    tips_received: stored?.tips_received ?? DEFAULT_PREFS.tips_received,
    chat_mentions: stored?.chat_mentions ?? DEFAULT_PREFS.chat_mentions,
    email_digest: stored?.email_digest ?? DEFAULT_PREFS.email_digest,
  };

  return NextResponse.json(prefs);
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, putBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { viewer_id, live_alerts, tips_received, chat_mentions, email_digest } =
    bodyResult.data;

  const existing = prefsStore.get(viewer_id);

  const updated: ViewerNotificationPrefs = {
    viewer_id,
    live_alerts: live_alerts ?? existing?.live_alerts ?? DEFAULT_PREFS.live_alerts,
    tips_received:
      tips_received ?? existing?.tips_received ?? DEFAULT_PREFS.tips_received,
    chat_mentions:
      chat_mentions ?? existing?.chat_mentions ?? DEFAULT_PREFS.chat_mentions,
    email_digest:
      email_digest ?? existing?.email_digest ?? DEFAULT_PREFS.email_digest,
  };

  prefsStore.set(viewer_id, updated);

  return NextResponse.json({
    live_alerts: updated.live_alerts,
    tips_received: updated.tips_received,
    chat_mentions: updated.chat_mentions,
    email_digest: updated.email_digest,
  });
}
