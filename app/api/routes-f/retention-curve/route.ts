/**
 * GET /api/routes-f/retention-curve?stream_id=
 *
 * Returns a viewer-retention curve for a given stream, normalised against
 * peak viewer count so each point shows the percentage of the audience
 * that was still watching at that minute.
 *
 * Query params:
 *   stream_id — required
 *
 * Response:
 *   { points: [{ minute, percent_of_peak, viewer_count }] }
 *
 * Error responses:
 *   400 — missing/invalid query params
 *   404 — stream not found
 */

import { NextRequest, NextResponse } from "next/server";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { querySchema } from "./schema";
import { SEED_SAMPLES } from "./seed";
import { normalizeRetention } from "./compute";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) {return queryResult;}

  const { stream_id } = queryResult.data;
  const samples = SEED_SAMPLES[stream_id];

  if (!samples) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  return NextResponse.json({ points: normalizeRetention(samples) });
}
