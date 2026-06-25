import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/routes-f/chat-emote-mode/[stream_id]
 * Disable emote-only mode for a stream
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ stream_id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { stream_id } = await params;

  try {
    const { rows: streamRows } = await sql`
      SELECT creator_id FROM streams WHERE id = ${stream_id}
    `;

    if (streamRows.length === 0) {
      return NextResponse.json(
        { error: "Stream not found" },
        { status: 404 }
      );
    }

    if (streamRows[0].creator_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`
      UPDATE emote_mode_settings
      SET enabled = false, updated_at = CURRENT_TIMESTAMP
      WHERE stream_id = ${stream_id}
    `;

    return NextResponse.json({ enabled: false, stream_id });
  } catch (error) {
    console.error("[Chat Emote Mode API] Error disabling mode:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
