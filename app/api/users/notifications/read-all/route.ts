import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { markAllNotificationsAsRead } from "@/lib/notifications";

export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const updatedCount = await markAllNotificationsAsRead(session.userId);
    return NextResponse.json({ updatedCount });
  } catch (error) {
    console.error("PATCH read-all error:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}