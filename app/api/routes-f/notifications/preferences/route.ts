/**
 * GET  /api/routes-f/notifications/preferences?follower_id=&creator_id=
 * PUT  /api/routes-f/notifications/preferences
 *
 * Manages per-follower notification preferences for a given creator.
 * Uses in-memory storage (mock) — no real DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NotificationPreference {
  follower_id: string;
  creator_id: string;
  notify_live: boolean;
  notify_vods: boolean;
}

// ---------------------------------------------------------------------------
// In-memory storage
// Key: `${follower_id}:${creator_id}`
// Exported so tests can reset between runs.
// ---------------------------------------------------------------------------
export const preferencesStore: Map<string, NotificationPreference> = new Map();

function storeKey(followerId: string, creatorId: string): string {
  return `${followerId}:${creatorId}`;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const getQuerySchema = z.object({
  follower_id: z.string().min(1, "follower_id is required"),
  creator_id: z.string().min(1, "creator_id is required"),
});

const putBodySchema = z.object({
  follower_id: z.string().min(1, "follower_id is required"),
  creator_id: z.string().min(1, "creator_id is required"),
  notify_live: z.boolean().optional(),
  notify_vods: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { follower_id, creator_id } = queryResult.data;
  const key = storeKey(follower_id, creator_id);

  const stored = preferencesStore.get(key);

  // Default both to true when no preference has been stored yet.
  const prefs: Pick<NotificationPreference, "notify_live" | "notify_vods"> = {
    notify_live: stored?.notify_live ?? true,
    notify_vods: stored?.notify_vods ?? true,
  };

  return NextResponse.json(prefs);
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, putBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { follower_id, creator_id, notify_live, notify_vods } = bodyResult.data;
  const key = storeKey(follower_id, creator_id);

  // Merge with existing prefs (defaulting to true for any un-set field).
  const existing = preferencesStore.get(key);
  const updated: NotificationPreference = {
    follower_id,
    creator_id,
    notify_live: notify_live ?? existing?.notify_live ?? true,
    notify_vods: notify_vods ?? existing?.notify_vods ?? true,
  };

  preferencesStore.set(key, updated);

  return NextResponse.json({
    notify_live: updated.notify_live,
    notify_vods: updated.notify_vods,
  });
}
