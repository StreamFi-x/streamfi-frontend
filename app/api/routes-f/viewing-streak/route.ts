/**
 * GET  /api/routes-f/viewing-streak?viewer_id=&creator_id=
 *   Returns the current streak record for a (viewer, creator) pair.
 *
 * POST /api/routes-f/viewing-streak/check-in
 *   Body: { viewer_id, creator_id, on_date?: "YYYY-MM-DD" }
 *   Records a viewing check-in. Increments streak if check-in is consecutive
 *   (within 1 day of last check-in), resets streak to 1 otherwise. Updates
 *   longest_streak if needed.
 *
 * Scope: all files live inside app/api/routes-f/viewing-streak/
 */

import { NextRequest, NextResponse } from "next/server";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { querySchema } from "./schema";
import { streakStore, storeKey } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) {return queryResult;}

  const { viewer_id, creator_id } = queryResult.data;
  const key = storeKey(viewer_id, creator_id);

  if (!streakStore[key]) {
    return NextResponse.json({ error: "Streak record not found" }, { status: 404 });
  }

  return NextResponse.json(streakStore[key]);
}
