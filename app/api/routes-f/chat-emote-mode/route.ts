import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enableEmoteModeSchema = z.object({
  stream_id: z.string(),
});

function isEmoteOnly(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) {return false;}

  for (const char of trimmed) {
    const code = char.codePointAt(0);
    if (!code) {continue;}

    if (code < 0x1F000) {
      if (!/[\p{Emoji}]/u.test(char)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * POST /api/routes-f/chat-emote-mode
 * Enable emote-only mode for a stream
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, enableEmoteModeSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { stream_id } = bodyResult.data;

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
      INSERT INTO emote_mode_settings (stream_id, enabled, created_at)
      VALUES (${stream_id}, true, CURRENT_TIMESTAMP)
      ON CONFLICT (stream_id)
      DO UPDATE SET enabled = true, updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({ enabled: true, stream_id });
  } catch (error) {
    console.error("[Chat Emote Mode API] Error enabling mode:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { isEmoteOnly };
