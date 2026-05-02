import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

// ── GET /api/routes-f/stream/transcription/[id]/vtt ──────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { id } = params;

  try {
    const { rows } = await sql`
      SELECT id, status, content, user_id
      FROM transcription_jobs
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 }
      );
    }

    const job = rows[0];

    if (job.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (job.status !== "ready" || !job.content) {
      return NextResponse.json(
        { error: "Transcription is not ready" },
        { status: 404 }
      );
    }

    return new Response(job.content, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Content-Disposition": `inline; filename="transcription-${id}.vtt"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[transcription VTT GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch VTT" },
      { status: 500 }
    );
  }
}
