import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/routes-f/featured-streams-set (#1545)
 *
 * Admin-only. Replaces the ordered array of featured streams shown on
 * the home page. The full list is replaced atomically (delete + insert
 * in one transaction) rather than diffed, so the request body is always
 * the complete, authoritative ordering — not a set of incremental edits.
 *
 * Distinct from /api/routes-f/featured-stream, which manages a single
 * "featured stream of the day" with date-keyed editorial overrides —
 * this route manages the plural, always-visible home page rail.
 *
 * Body: { stream_ids: string[] }  — order in the array is the display order.
 */

interface SetFeaturedStreamsBody {
  stream_ids: unknown;
}

const MAX_FEATURED_STREAMS = 20;

function validateBody(
  body: unknown
): { streamIds: string[] } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be a JSON object" };
  }

  const { stream_ids } = body as SetFeaturedStreamsBody;

  if (!Array.isArray(stream_ids)) {
    return { error: "stream_ids must be an array" };
  }

  if (stream_ids.length === 0) {
    return { error: "stream_ids must not be empty" };
  }

  if (stream_ids.length > MAX_FEATURED_STREAMS) {
    return {
      error: `stream_ids must not exceed ${MAX_FEATURED_STREAMS} entries`,
    };
  }

  if (!stream_ids.every(id => typeof id === "string" && id.trim().length > 0)) {
    return { error: "Every entry in stream_ids must be a non-empty string" };
  }

  const uniqueIds = new Set(stream_ids);
  if (uniqueIds.size !== stream_ids.length) {
    return { error: "stream_ids must not contain duplicates" };
  }

  return { streamIds: stream_ids as string[] };
}

export async function PUT(req: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateBody(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { streamIds } = validated;

  try {
    await sql`BEGIN`;

    await sql`DELETE FROM featured_streams`;

    for (let position = 0; position < streamIds.length; position++) {
      await sql`
        INSERT INTO featured_streams (stream_id, display_order, set_at)
        VALUES (${streamIds[position]}, ${position}, CURRENT_TIMESTAMP)
      `;
    }

    await sql`COMMIT`;
  } catch (error) {
    await sql`ROLLBACK`;
    console.error("[featured-streams-set] failed:", error);
    return NextResponse.json(
      { error: "Failed to update featured streams" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    stream_ids: streamIds,
    count: streamIds.length,
    set_at: new Date().toISOString(),
  });
}
