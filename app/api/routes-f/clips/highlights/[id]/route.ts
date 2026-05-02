import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const updateHighlightSchema = z
  .object({
    title: z.string().min(1).max(160).optional(),
    clip_ids: z.array(z.string().uuid()).min(1).max(20).optional(),
    cover_clip_id: z.string().uuid().optional(),
  })
  .refine(
    body =>
      body.title !== undefined ||
      body.clip_ids !== undefined ||
      body.cover_clip_id !== undefined,
    "At least one field is required"
  )
  .refine(
    body =>
      body.cover_clip_id === undefined ||
      body.clip_ids === undefined ||
      body.clip_ids.includes(body.cover_clip_id),
    {
      message:
        "cover_clip_id must be included in clip_ids when clip_ids is provided",
      path: ["cover_clip_id"],
    }
  );

async function ensureHighlightsTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS clip_highlight_collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      cover_clip_id UUID NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clip_highlight_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      collection_id UUID NOT NULL REFERENCES clip_highlight_collections(id) ON DELETE CASCADE,
      clip_id UUID NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (collection_id, clip_id),
      UNIQUE (collection_id, position)
    )
  `;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const bodyResult = await validateBody(req, updateHighlightSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureHighlightsTables();

    const { rows: collectionRows } = await sql`
      SELECT id, title, cover_clip_id
      FROM clip_highlight_collections
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      LIMIT 1
    `;

    if (collectionRows.length === 0) {
      return NextResponse.json(
        { error: "Highlight collection not found" },
        { status: 404 }
      );
    }

    const current = collectionRows[0];

    await sql`BEGIN`;
    try {
      let nextCover =
        bodyResult.data.cover_clip_id ?? (current.cover_clip_id as string);

      if (bodyResult.data.clip_ids) {
        if (!bodyResult.data.clip_ids.includes(nextCover)) {
          throw new Error("cover_clip_not_in_clip_ids");
        }

        await sql`
          DELETE FROM clip_highlight_items
          WHERE collection_id = ${id}
        `;

        for (let i = 0; i < bodyResult.data.clip_ids.length; i += 1) {
          await sql`
            INSERT INTO clip_highlight_items (collection_id, clip_id, position)
            VALUES (${id}, ${bodyResult.data.clip_ids[i]}, ${i})
          `;
        }
      }

      if (bodyResult.data.cover_clip_id && !bodyResult.data.clip_ids) {
        const { rows: exists } = await sql`
          SELECT 1
          FROM clip_highlight_items
          WHERE collection_id = ${id}
            AND clip_id = ${bodyResult.data.cover_clip_id}
          LIMIT 1
        `;
        if (exists.length === 0) {
          throw new Error("cover_clip_not_in_clip_ids");
        }
        nextCover = bodyResult.data.cover_clip_id;
      }

      const { rows: updatedRows } = await sql`
        UPDATE clip_highlight_collections
        SET
          title = ${bodyResult.data.title ?? (current.title as string)},
          cover_clip_id = ${nextCover},
          updated_at = NOW()
        WHERE id = ${id}
          AND creator_id = ${session.userId}
        RETURNING id, title, cover_clip_id, created_at, updated_at
      `;

      const { rows: itemRows } = await sql`
        SELECT clip_id, position
        FROM clip_highlight_items
        WHERE collection_id = ${id}
        ORDER BY position ASC
      `;

      await sql`COMMIT`;

      return NextResponse.json({
        id: updatedRows[0].id,
        title: updatedRows[0].title,
        cover_clip_id: updatedRows[0].cover_clip_id,
        clips: itemRows.map(row => ({
          clip_id: row.clip_id,
          position: Number(row.position),
        })),
        created_at: updatedRows[0].created_at,
        updated_at: updatedRows[0].updated_at,
      });
    } catch (txErr) {
      await sql`ROLLBACK`;
      throw txErr;
    }
  } catch (err) {
    if (err instanceof Error && err.message === "cover_clip_not_in_clip_ids") {
      return NextResponse.json(
        { error: "cover_clip_id must be included in clip_ids" },
        { status: 400 }
      );
    }
    console.error("[clips/highlights/:id] PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureHighlightsTables();

    const { rowCount } = await sql`
      DELETE FROM clip_highlight_collections
      WHERE id = ${id}
        AND creator_id = ${session.userId}
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Highlight collection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Highlight collection removed" });
  } catch (err) {
    console.error("[clips/highlights/:id] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
