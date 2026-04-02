/**
 * DELETE /api/routes-f/vod/chapters/[id] — remove a chapter marker
 *
 * Auth required. Caller must own the recording the chapter belongs to.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";

const isIpRateLimited = createRateLimiter(60_000, 5);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid chapter id format" },
      { status: 400 }
    );
  }

  try {
    // Join to stream_recordings to verify the caller owns the recording
    const { rows } = await sql`
      SELECT c.id, r.user_id
      FROM vod_chapters c
      JOIN stream_recordings r ON r.id = c.recording_id
      WHERE c.id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    if (rows[0].user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`DELETE FROM vod_chapters WHERE id = ${id}`;

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[vod/chapters] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
