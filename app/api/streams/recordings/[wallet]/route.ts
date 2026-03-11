import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/streams/recordings/[wallet]
 *
 * Two modes determined by the path param format:
 *  - UUID  → fetch a single ready recording by its ID
 *            Response: { recording: {...} }
 *  - other → treat as wallet address, list all recordings for that user
 *            Response: { success: true, recordings: [...] }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "Wallet or ID required" },
        { status: 400 }
      );
    }

    // ── Single recording by UUID ──────────────────────────────────────────
    if (UUID_RE.test(wallet)) {
      const { rows } = await sql`
        SELECT
          r.id,
          r.mux_asset_id,
          r.playback_id,
          r.title,
          r.duration,
          r.created_at,
          r.status,
          u.username,
          u.avatar,
          u.bio,
          ss.started_at AS stream_date
        FROM stream_recordings r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
        WHERE r.id = ${wallet}
          AND r.status = 'ready'
      `;

      if (rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({ recording: rows[0] });
    }

    // ── All recordings for a wallet address ───────────────────────────────
    const result = await sql`
      SELECT
        r.id,
        r.mux_asset_id,
        r.playback_id,
        r.title,
        r.duration,
        r.created_at,
        r.status,
        r.needs_review,
        ss.started_at AS stream_date
      FROM stream_recordings r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
      WHERE LOWER(u.wallet) = LOWER(${wallet})
      ORDER BY r.created_at DESC
    `;

    return NextResponse.json({
      success: true,
      recordings: result.rows,
    });
  } catch (error) {
    console.error("Error fetching recordings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/streams/recordings/[id]
 * Auth required. Owner only. Permanently removes the recording from the DB.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { wallet: id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid recording ID" },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    SELECT user_id FROM stream_recordings WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (rows[0].user_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sql`DELETE FROM stream_recordings WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/streams/recordings/[id]
 * Auth required. Owner only. Clears the needs_review flag ("Keep" action).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { wallet: id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid recording ID" },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    UPDATE stream_recordings
    SET needs_review = false
    WHERE id = ${id} AND user_id = ${session.userId}
    RETURNING id
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Not found or forbidden" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
