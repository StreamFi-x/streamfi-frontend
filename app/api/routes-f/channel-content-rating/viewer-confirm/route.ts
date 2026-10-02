/**
 * POST /api/routes-f/channel-content-rating/viewer-confirm
 * Body: { viewer_id, creator_id, accept_mature: boolean }
 *
 * Records (or revokes) a viewer's confirmation that they accept mature content
 * for a given creator. Gating: only meaningful when creator's rating is "mature".
 */
import { NextRequest, NextResponse } from "next/server";
import { matureConfirmations, getRating } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, creator_id, accept_mature } = (body ?? {}) as Record<string, unknown>;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }
  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (typeof accept_mature !== "boolean") {
    return NextResponse.json({ error: "accept_mature must be a boolean" }, { status: 400 });
  }

  const rating = getRating(creator_id);
  if (rating !== "mature") {
    return NextResponse.json(
      { error: "creator channel is not rated mature; confirmation not required" },
      { status: 422 }
    );
  }

  if (!matureConfirmations.has(creator_id)) {
    matureConfirmations.set(creator_id, new Set());
  }
  const set = matureConfirmations.get(creator_id)!;

  if (accept_mature) {
    set.add(viewer_id);
  } else {
    set.delete(viewer_id);
  }

  return NextResponse.json({
    viewer_id,
    creator_id,
    accepted: accept_mature,
    confirmed_at: new Date().toISOString(),
  });
}
