/**
 * GET  /api/routes-f/notification-preferences?viewer_id=
 * PUT  /api/routes-f/notification-preferences
 *
 * Per-viewer notification preferences for live alerts, tips, mentions, email digest.
 * Defaults: all true except email_digest (false).
 * Uses in-memory storage — no real DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";

export interface NotificationPrefs {
  viewer_id: string;
  live_alerts: boolean;
  tips_received: boolean;
  chat_mentions: boolean;
  email_digest: boolean;
}

export const prefsStore: Map<string, NotificationPrefs> = new Map();

function defaults(viewer_id: string): NotificationPrefs {
  return { viewer_id, live_alerts: true, tips_received: true, chat_mentions: true, email_digest: false };
}

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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const result = validateQuery(searchParams, getQuerySchema);
  if (result instanceof NextResponse) {return result;}

  const { viewer_id } = result.data;
  const prefs = prefsStore.get(viewer_id) ?? defaults(viewer_id);
  const { live_alerts, tips_received, chat_mentions, email_digest } = prefs;
  return NextResponse.json({ live_alerts, tips_received, chat_mentions, email_digest });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, putBodySchema);
  if (result instanceof NextResponse) {return result;}

  const { viewer_id, ...updates } = result.data;
  const existing = prefsStore.get(viewer_id) ?? defaults(viewer_id);
  const updated: NotificationPrefs = { ...existing, ...updates };
  prefsStore.set(viewer_id, updated);

  const { live_alerts, tips_received, chat_mentions, email_digest } = updated;
  return NextResponse.json({ live_alerts, tips_received, chat_mentions, email_digest });
}
