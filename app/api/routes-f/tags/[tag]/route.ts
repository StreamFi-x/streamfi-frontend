import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
): Promise<Response> {
  const { tag } = await params;
  const normalized = tag.trim().toLowerCase();

  const { rows } = await sql`
    SELECT
      u.id,
      u.username,
      u.avatar,
      u.mux_playback_id,
      u.current_viewers,
      u.creator
    FROM stream_tags st
    JOIN tags t ON t.id = st.tag_id
    JOIN users u ON u.id = st.stream_id
    WHERE t.name = ${normalized}
      AND u.is_live = true
    ORDER BY u.current_viewers DESC, u.stream_started_at DESC
    LIMIT 100
  `;

  return NextResponse.json({ tag: normalized, streams: rows });
}
