import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { getIncomingRaid } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/live/raid/incoming
 * Target creator polls for incoming raid.
 */
export async function GET(req: NextRequest) {
  let userId: string | null = null;
  const testUserId = req.headers.get("x-user-id");

  if (testUserId) {
    userId = testUserId;
  } else {
    const session = await verifySession(req);
    if (session.ok) {
      userId = session.userId;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raid = getIncomingRaid(userId);
    return NextResponse.json({ raid });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
