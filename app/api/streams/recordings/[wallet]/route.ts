import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

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
