/**
 * GET  /api/routes-f/notification-preferences
 * PUT  /api/routes-f/notification-preferences
 *
 * Per-user notification preferences persisted in notification_preferences.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications/preferences";

const putBodySchema = z
  .object({
    notify_follow: z.boolean().optional(),
    notify_live: z.boolean().optional(),
    notify_tip_received: z.boolean().optional(),
    notify_new_subscriber: z.boolean().optional(),
    notify_clip_featured: z.boolean().optional(),
    notify_clip_created: z.boolean().optional(),
    notify_payment_confirmed: z.boolean().optional(),
    notify_system: z.boolean().optional(),
    email_notify_follow: z.boolean().optional(),
    email_notify_live: z.boolean().optional(),
    email_notify_tip_received: z.boolean().optional(),
    email_notify_new_subscriber: z.boolean().optional(),
    email_notify_clip_featured: z.boolean().optional(),
    email_notify_payment_confirmed: z.boolean().optional(),
    email_digest: z.boolean().optional(),
    unsubscribed_all: z.boolean().optional(),
  })
  .strict();

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  if (new URL(req.url).searchParams.has("user_id")) {
    return NextResponse.json(
      { error: "Notification preferences are scoped to the current session" },
      { status: 400 }
    );
  }

  try {
    const prefs = await getNotificationPreferences(session.userId);
    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[notification-preferences GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const result = await validateBody(req, putBodySchema);
  if (result instanceof NextResponse) {
    return result;
  }

  try {
    const updated = await updateNotificationPreferences(
      session.userId,
      result.data,
      sql
    );
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[notification-preferences PUT] error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
