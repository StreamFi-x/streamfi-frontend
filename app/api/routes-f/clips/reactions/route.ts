import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { REACTION_EMOJIS, ensureClipReactionSchema } from "./_lib/db";

const reactionBodySchema = z.object({
  clip_id: uuidSchema,
  emoji: z.enum(REACTION_EMOJIS),
});

const reactionQuerySchema = z.object({
  clip_id: uuidSchema,
});

async function getReactionSummary(clipId: string) {
  const { rows } = await sql`
    SELECT emoji, COUNT(*)::int AS count
    FROM route_f_clip_reactions
    WHERE clip_id = ${clipId}
    GROUP BY emoji
    ORDER BY emoji ASC
  `;

  return {
    total_count: rows.reduce((total, row) => total + Number(row.count), 0),
    breakdown: rows,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, reactionQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureClipReactionSchema();

    return NextResponse.json(
      await getReactionSummary(queryResult.data.clip_id)
    );
  } catch (error) {
    console.error("[clips/reactions] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, reactionBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { clip_id, emoji } = bodyResult.data;

  try {
    await ensureClipReactionSchema();

    const { rows: clipRows } = await sql`
      SELECT id
      FROM stream_recordings
      WHERE id = ${clip_id}
      LIMIT 1
    `;

    if (clipRows.length === 0) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    const { rows } = await sql`
      INSERT INTO route_f_clip_reactions (clip_id, user_id, emoji)
      VALUES (${clip_id}, ${session.userId}, ${emoji})
      ON CONFLICT (clip_id, user_id, emoji) DO NOTHING
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Reaction already exists for this emoji" },
        { status: 409 }
      );
    }

    return NextResponse.json(await getReactionSummary(clip_id), {
      status: 201,
    });
  } catch (error) {
    console.error("[clips/reactions] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, reactionBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { clip_id, emoji } = bodyResult.data;

  try {
    await ensureClipReactionSchema();

    await sql`
      DELETE FROM route_f_clip_reactions
      WHERE clip_id = ${clip_id}
        AND user_id = ${session.userId}
        AND emoji = ${emoji}
    `;

    return NextResponse.json(await getReactionSummary(clip_id));
  } catch (error) {
    console.error("[clips/reactions] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
