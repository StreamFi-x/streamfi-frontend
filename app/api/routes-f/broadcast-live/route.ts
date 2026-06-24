/**
 * POST /api/routes-f/broadcast-live
 *
 * Broadcasts a live notification to all followers of a creator.
 * Skips followers where:
 *   - muted_creators contains creator_id (from MUTED_PAIRS seed)
 *   - notify_live is false in viewer-notification-prefs store
 *
 * Returns { notified_count }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { FOLLOWERS, MUTED_PAIRS } from "./_seed";
import { prefsStore } from "@/app/api/routes-f/viewer-notification-prefs/route";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const postBodySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  stream_title: z.string().min(1, "stream_title is required"),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, postBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { creator_id } = bodyResult.data;

  const followers = FOLLOWERS.get(creator_id) ?? [];

  let notified_count = 0;

  for (const follower_id of followers) {
    // Skip if this follower has muted the creator
    if (MUTED_PAIRS.has(`${follower_id}:${creator_id}`)) {
      continue;
    }

    // Skip if viewer has explicitly set notify_live to false
    const viewerPrefs = prefsStore.get(follower_id);
    if (viewerPrefs !== undefined && viewerPrefs.live_alerts === false) {
      continue;
    }

    notified_count += 1;
  }

  return NextResponse.json({ notified_count });
}
