import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const listHighlightsSchema = z.object({
  creator: z.string().uuid("creator must be a valid UUID"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
});

const createHighlightsSchema = z
  .object({
    title: z.string().min(1).max(160),
    clip_ids: z.array(z.string().uuid()).min(1).max(20),
    cover_clip_id: z.string().uuid(),
  })
  .refine(body => body.clip_ids.includes(body.cover_clip_id), {
    message: "cover_clip_id must be included in clip_ids",
    path: ["cover_clip_id"],
  });

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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_clip_highlight_creator_created
    ON clip_highlight_collections (creator_id, created_at DESC)
  `;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    listHighlightsSchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { creator, limit, cursor } = queryResult.data;

  try {
    await ensureHighlightsTables();

    const { rows: collections } = cursor
      ? await sql`
          SELECT id, title, cover_clip_id, created_at, updated_at
          FROM clip_highlight_collections
          WHERE creator_id = ${creator}
            AND is_public = TRUE
            AND created_at < (
              SELECT created_at
              FROM clip_highlight_collections
              WHERE id = ${cursor}
              LIMIT 1
            )
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, title, cover_clip_id, created_at, updated_at
          FROM clip_highlight_collections
          WHERE creator_id = ${creator}
            AND is_public = TRUE
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

    if (collections.length === 0) {
      return NextResponse.json({ collections: [], next_cursor: null });
    }

    const ids = collections.map(row => row.id as string);
    const { rows: items } = await sql`
      SELECT collection_id, clip_id, position
      FROM clip_highlight_items
      WHERE collection_id = ANY(${ids}::uuid[])
      ORDER BY collection_id ASC, position ASC
    `;

    const grouped = new Map<
      string,
      Array<{ clip_id: string; position: number }>
    >();
    for (const item of items) {
      const collectionId = item.collection_id as string;
      if (!grouped.has(collectionId)) {
        grouped.set(collectionId, []);
      }
      grouped.get(collectionId)?.push({
        clip_id: item.clip_id as string,
        position: Number(item.position),
      });
    }

    const payload = collections.map(row => ({
      id: row.id,
      title: row.title,
      cover_clip_id: row.cover_clip_id,
      clips: grouped.get(row.id as string) ?? [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const nextCursor =
      payload.length === limit
        ? (payload[payload.length - 1].id as string)
        : null;

    return NextResponse.json({ collections: payload, next_cursor: nextCursor });
  } catch (err) {
    console.error("[clips/highlights] GET error:", err);
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

  const bodyResult = await validateBody(req, createHighlightsSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { title, clip_ids, cover_clip_id } = bodyResult.data;

  try {
    await ensureHighlightsTables();

    await sql`BEGIN`;
    try {
      const { rows: collectionRows } = await sql`
        INSERT INTO clip_highlight_collections (creator_id, title, cover_clip_id)
        VALUES (${session.userId}, ${title}, ${cover_clip_id})
        RETURNING id, title, cover_clip_id, created_at, updated_at
      `;

      const collection = collectionRows[0];
      for (let i = 0; i < clip_ids.length; i += 1) {
        await sql`
          INSERT INTO clip_highlight_items (collection_id, clip_id, position)
          VALUES (${collection.id}, ${clip_ids[i]}, ${i})
        `;
      }

      await sql`COMMIT`;

      return NextResponse.json(
        {
          id: collection.id,
          title: collection.title,
          cover_clip_id: collection.cover_clip_id,
          clips: clip_ids.map((clipId, idx) => ({
            clip_id: clipId,
            position: idx,
          })),
          created_at: collection.created_at,
          updated_at: collection.updated_at,
        },
        { status: 201 }
      );
    } catch (txErr) {
      await sql`ROLLBACK`;
      throw txErr;
    }
  } catch (err) {
    console.error("[clips/highlights] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
