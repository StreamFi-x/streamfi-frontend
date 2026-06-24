/**
 * GET /api/routes-f/raid-suggestions?from_creator_id=&limit=5
 *
 * Returns personalized raid target suggestions for a creator.
 * Only returns live creators, excludes self and blocked pairs,
 * ranked by shared_followers descending.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { LIVE_STREAMS, BLOCKED_PAIRS } from "./_seed";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const getQuerySchema = z.object({
  from_creator_id: z.string().min(1, "from_creator_id is required"),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 5))
    .pipe(z.number().int().min(1).max(50)),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { from_creator_id, limit } = queryResult.data;

  const suggestions = LIVE_STREAMS
    .filter((stream) => {
      if (!stream.is_live) return false;
      if (stream.creator_id === from_creator_id) return false;
      if (BLOCKED_PAIRS.has(`${from_creator_id}:${stream.creator_id}`)) return false;
      return true;
    })
    .sort((a, b) => b.shared_followers - a.shared_followers)
    .slice(0, limit)
    .map((stream) => ({
      creator_id: stream.creator_id,
      viewers_now: stream.viewers_now,
      shared_followers: stream.shared_followers,
      reason:
        stream.shared_followers > 200
          ? "High audience overlap"
          : "Live now with shared audience",
    }));

  return NextResponse.json({ suggestions });
}
