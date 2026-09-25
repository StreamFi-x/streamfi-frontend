/**
 * POST  /api/routes-f/broadcast-live
 *
 * Fan out a "creator is live" notification to all followers, skipping those
 * who have muted the creator or have notify_live=false.
 * Returns { notified_count }.
 * Uses in-memory seed data — no real DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
interface Follower {
  follower_id: string;
  creator_id: string;
  notify_live: boolean;
  muted: boolean;
}

export const FOLLOWERS: Follower[] = [
  { follower_id: "f-001", creator_id: "c-001", notify_live: true, muted: false },
  { follower_id: "f-002", creator_id: "c-001", notify_live: true, muted: false },
  { follower_id: "f-003", creator_id: "c-001", notify_live: false, muted: false },
  { follower_id: "f-004", creator_id: "c-001", notify_live: true, muted: true },
  { follower_id: "f-005", creator_id: "c-001", notify_live: true, muted: false },
  { follower_id: "f-006", creator_id: "c-002", notify_live: true, muted: false },
  { follower_id: "f-007", creator_id: "c-002", notify_live: true, muted: false },
  { follower_id: "f-008", creator_id: "c-002", notify_live: false, muted: false },
];

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const bodySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  stream_title: z.string().min(1, "stream_title is required"),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, bodySchema);
  if (result instanceof NextResponse) {return result;}

  const { creator_id } = result.data;

  const eligible = FOLLOWERS.filter(
    (f) => f.creator_id === creator_id && f.notify_live && !f.muted
  );

  return NextResponse.json({ notified_count: eligible.length });
}
