/**
 * GET /api/routes-f/notifications
 *
 * Paginated notification inbox for a StreamFi viewer.
 *
 * Query params:
 *   viewer_id  — required; the viewer's identifier
 *   limit      — optional; items per page (1-100, default 20)
 *   cursor     — optional; notification id to start after (exclusive)
 *
 * Response:
 *   {
 *     items:        Notification[],  // sorted newest → oldest
 *     next_cursor:  string | null,   // id of last item, or null if no more pages
 *     unread_count: number           // total unread across ALL pages for this viewer
 *   }
 *
 * Error responses:
 *   400 — missing or invalid query params
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getSeedNotifications } from "./_lib/seed";

const querySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { viewer_id, limit, cursor } = queryResult.data;

  const all = getSeedNotifications(viewer_id);
  const unread_count = all.filter((n) => !n.read).length;

  // Apply cursor: skip items up to and including the cursor id
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = all.findIndex((n) => n.id === cursor);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  const page = all.slice(startIndex, startIndex + limit);
  const next_cursor = page.length === limit && startIndex + limit < all.length
    ? page[page.length - 1].id
    : null;

  return NextResponse.json({ items: page, next_cursor, unread_count });
}
