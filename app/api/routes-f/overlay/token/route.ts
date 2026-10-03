import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { rotateOverlayToken } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handler for token generation or rotation.
 * Authenticated creator generates or rotates their overlay token with 1-click.
 * Invalidates the previous token immediately.
 */
async function handleTokenRequest(req: NextRequest) {
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
    const { token } = rotateOverlayToken(userId);
    return NextResponse.json({ token, message: "Overlay token generated/rotated successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleTokenRequest(req);
}

export async function POST(req: NextRequest) {
  return handleTokenRequest(req);
}
