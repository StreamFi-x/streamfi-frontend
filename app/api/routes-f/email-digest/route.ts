/**
 * GET  /api/routes-f/email-digest?viewer_id=
 * PUT  /api/routes-f/email-digest
 *
 * GET  — returns current digest preferences for the viewer.
 *         If no record exists, returns sensible defaults (disabled).
 * PUT  — partial update: only supplied fields are overwritten.
 *
 * GET response:
 *   { enabled, day_of_week, sections }
 *
 * PUT body:
 *   { viewer_id, enabled?, day_of_week?, sections? }
 *
 * PUT response:
 *   { enabled, day_of_week, sections }
 *
 * Error responses:
 *   400 — missing/invalid params or body
 */

import { NextRequest, NextResponse } from "next/server";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";
import { getQuerySchema, putBodySchema } from "./schema";
import { getPrefs, upsertPrefs } from "./store";
import type { DigestPreferences, DayOfWeek, DigestSection } from "./types";

const DEFAULT_PREFS = (viewerId: string): DigestPreferences => ({
  viewer_id: viewerId,
  enabled: false,
  day_of_week: "monday" as DayOfWeek,
  sections: [] as DigestSection[],
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { viewer_id } = queryResult.data;
  const prefs = getPrefs(viewer_id) ?? DEFAULT_PREFS(viewer_id);

  return NextResponse.json({
    enabled: prefs.enabled,
    day_of_week: prefs.day_of_week,
    sections: prefs.sections,
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, putBodySchema);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const { viewer_id, enabled, day_of_week, sections } = bodyResult.data;
  const existing = getPrefs(viewer_id) ?? DEFAULT_PREFS(viewer_id);

  const updated: DigestPreferences = {
    viewer_id,
    enabled: enabled !== undefined ? enabled : existing.enabled,
    day_of_week: day_of_week ?? existing.day_of_week,
    sections: sections !== undefined ? (sections as DigestSection[]) : existing.sections,
  };

  upsertPrefs(updated);

  return NextResponse.json({
    enabled: updated.enabled,
    day_of_week: updated.day_of_week,
    sections: updated.sections,
  });
}
