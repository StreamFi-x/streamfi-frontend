/**
 * GET /api/routes-f/playback-quality?playback_id=<id>[&connection_type=<hint>]
 *
 * Returns the available playback quality renditions for a stream session,
 * along with a recommended default rendition.
 *
 * Query params:
 *   playback_id      — required. The Mux playback ID for the active stream.
 *   connection_type  — optional hint. One of: wifi | cellular | 4g | 3g | 2g | slow-2g
 *                      When provided the default rendition is tuned for that connection.
 *                      Omitting it falls back to "Auto" (adaptive bitrate).
 *
 * Response 200:
 *   {
 *     options: Array<{ label: string; resolution: string; bandwidth_kbps: number }>,
 *     default: string   // label of the recommended rendition
 *   }
 *
 * Error responses:
 *   400 — playback_id is missing or empty
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ALL_RENDITIONS, resolveDefault } from "./renditions";
import type { PlaybackQualityResponse } from "./types";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const querySchema = z.object({
  playback_id: z.string().min(1, "playback_id is required"),
  connection_type: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/routes-f/playback-quality
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);

  if (queryResult instanceof NextResponse) return queryResult;

  const { connection_type } = queryResult.data;

  const response: PlaybackQualityResponse = {
    options: ALL_RENDITIONS,
    default: resolveDefault(connection_type),
  };

  return NextResponse.json(response);
}
