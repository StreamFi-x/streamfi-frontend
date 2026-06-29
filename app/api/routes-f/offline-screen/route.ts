/**
 * GET  /api/routes-f/offline-screen?creator_id=
 *   Returns { type: image|clip|vod|none, source_url?, vod_id? }
 *
 * POST /api/routes-f/offline-screen
 *   Body: { creator_id, type, source_url?, vod_id? }
 *   Sets or updates the offline screen configuration for a creator.
 *   - type=image|clip requires source_url
 *   - type=vod requires vod_id
 *
 * Scope: all files live inside app/api/routes-f/offline-screen/
 */

import { NextRequest, NextResponse } from "next/server";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";
import { querySchema, setSchema } from "./schema";
import { offlineScreenStore } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { creator_id } = queryResult.data;

  if (!offlineScreenStore[creator_id]) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  return NextResponse.json(offlineScreenStore[creator_id]);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, setSchema);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const { creator_id, type, source_url, vod_id } = bodyResult.data;

  const config: typeof offlineScreenStore[string] = { type };
  if (source_url) config.source_url = source_url;
  if (vod_id) config.vod_id = vod_id;

  offlineScreenStore[creator_id] = config;

  return NextResponse.json(offlineScreenStore[creator_id]);
}
