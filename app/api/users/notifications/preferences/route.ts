import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications";

const preferencesSchema = z.object({
  newFollower: z.boolean().optional(),
  tipReceived: z.boolean().optional(),
  streamLive: z.boolean().optional(),
  recordingReady: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const preferences = await getNotificationPreferences(session.userId);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("GET notification preferences error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = preferencesSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification preferences" },
      { status: 400 }
    );
  }

  try {
    const preferences = await updateNotificationPreferences(
      session.userId,
      parsed.data
    );
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("PUT notification preferences error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}