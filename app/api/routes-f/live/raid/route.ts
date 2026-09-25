import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";
import { initiateRaid } from "./store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const raidSchema = z.object({
  targetUsername: z.string().min(1),
  viewerCount: z.number().int().min(0).max(100000),
});

/**
 * POST /api/routes-f/live/raid
 * Initiate a raid with confirmation, cooldown check, and recipient opt-out verification.
 */
export async function POST(req: NextRequest) {
  // Allow session or test user header
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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = raidSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.format() },
        { status: 400 }
      );
    }

    const { targetUsername, viewerCount } = result.data;
    const outcome = initiateRaid(userId, targetUsername, viewerCount);

    if (!outcome.success) {
      switch (outcome.code) {
        case "TARGET_NOT_FOUND":
          return NextResponse.json({ error: outcome.error, code: outcome.code }, { status: 404 });
        case "TARGET_OPTED_OUT":
          return NextResponse.json({ error: outcome.error, code: outcome.code }, { status: 403 });
        case "RAID_COOLDOWN":
          return NextResponse.json({ error: outcome.error, code: outcome.code }, { status: 429 });
        default:
          return NextResponse.json({ error: outcome.error, code: outcome.code }, { status: 400 });
      }
    }

    return NextResponse.json(
      {
        message: `Raid initiated to ${targetUsername} with ${viewerCount} viewers`,
        raid: outcome.raid,
        prompt: outcome.prompt,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
