/**
 * GET  /api/routes-f/notification-preferences?user_id=
 * PUT  /api/routes-f/notification-preferences
 *
 * Per-user notification preferences for all notification types and channels.
 * Now persisted to database instead of in-memory storage.
 * See #1369 for context.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import { 
  getNotificationPreferences, 
  updateNotificationPreferences,
  type NotificationPreferences 
} from "@/lib/notifications/preferences";

const getQuerySchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID").optional(),
});

const putBodySchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID").optional(),
  notify_follow: z.boolean().optional(),
  notify_live: z.boolean().optional(),
  notify_tip_received: z.boolean().optional(),
  notify_new_subscriber: z.boolean().optional(),
  notify_clip_featured: z.boolean().optional(),
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
});

/**
 * GET - Fetch user's notification preferences.
 * Can be called with ?user_id= query param or will use authenticated session.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  
  // Try to get user_id from query params first
  let userId = searchParams.get("user_id");

  // If not provided, try to get from session
  if (!userId) {
    const session = await verifySession(req);
    if (!session.ok) {
      return NextResponse.json(
        { error: "user_id query param or authentication required" },
        { status: 400 }
      );
    }
    userId = session.userId;
  }

  try {
    const prefs = await getNotificationPreferences(userId);
    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[notification-preferences GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update user's notification preferences.
 * Can update from authenticated session or by passing user_id in body.
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, putBodySchema);
  if (result instanceof NextResponse) {
    return result;
  }

  const { user_id: bodyUserId, ...updates } = result.data;

  // Get user_id: prefer body, then session
  let userId = bodyUserId;
  if (!userId) {
    const session = await verifySession(req);
    if (!session.ok) {
      return NextResponse.json(
        { error: "user_id in body or authentication required" },
        { status: 400 }
      );
    }
    userId = session.userId;
  }

  try {
    const updated = await updateNotificationPreferences(userId, updates, { sql });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[notification-preferences PUT] error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
