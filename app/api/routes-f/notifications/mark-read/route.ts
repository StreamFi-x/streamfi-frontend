/**
 * POST /api/routes-f/notifications/mark-read
 *
 * Mark one or many notifications as read for a viewer.
 *
 * Body:
 *   { viewer_id, ids?: string[], all?: boolean }
 *   — Provide ids (non-empty array) OR all=true; not both required.
 *
 * Response:
 *   { updated_count: number }
 *
 * Error responses:
 *   400 — missing/invalid body
 */

import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { markReadSchema } from "./schema";
import { markById, markAll } from "./helpers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, markReadSchema);
  if (bodyResult instanceof NextResponse) {return bodyResult;}

  const { viewer_id, ids, all } = bodyResult.data;

  const updated_count =
    all === true ? markAll(viewer_id) : markById(viewer_id, ids ?? []);

  return NextResponse.json({ updated_count });
}
