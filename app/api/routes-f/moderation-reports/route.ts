/**
 * GET /api/routes-f/moderation-reports
 *
 * List moderation reports for a creator's moderation queue.
 *
 * Query params:
 *   creator_id   — required. The creator whose queue to fetch.
 *   status       — optional. "open" | "resolved". Omit to return all statuses.
 *   limit        — optional. Max results to return (1–100, default 20).
 *
 * Response 200:
 *   {
 *     reports: Array<{ id, target_type, target_id, reporter_id, reason, created_at, status }>,
 *     total: number   // count after filtering, before limit
 *   }
 *
 * Error responses:
 *   400 — invalid / missing query params
 *   404 — creator not found
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { SEED_REPORTS } from "./seed";
import type { ModerationReport, ReportStatus } from "./types";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  status: z.enum(["open", "resolved"]).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

// ---------------------------------------------------------------------------
// Known creator IDs drawn from the seed (acts as a lightweight registry)
// ---------------------------------------------------------------------------

const KNOWN_CREATORS = new Set(SEED_REPORTS.map((r) => r.creator_id));

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { creator_id, status, limit } = queryResult.data;

  if (!KNOWN_CREATORS.has(creator_id)) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  // Filter by creator, then optionally by status
  let filtered: ModerationReport[] = SEED_REPORTS.filter(
    (r) => r.creator_id === creator_id
  );

  if (status) {
    filtered = filtered.filter((r) => r.status === (status as ReportStatus));
  }

  // Sort newest first
  filtered.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const total = filtered.length;
  const page = filtered.slice(0, limit);

  // Strip internal creator_id from the response
  const reports = page.map(({ creator_id: _cid, ...rest }) => rest);

  return NextResponse.json({ reports, total });
}
