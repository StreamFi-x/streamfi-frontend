import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { usernameSchema, uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureClipCollectionsSchema } from "./_lib/db";

const listCollectionsQuerySchema = z.object({
  creator: usernameSchema,
});

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  clip_ids: z.array(uuidSchema).max(30).default([]),
});

function uniqueClipIds(clipIds: string[]) {
  return [...new Set(clipIds)];
}

async function assertOwnedClips(clipIds: string[], creatorId: string) {
  if (clipIds.length === 0) {
    return true;
  }

  const results = await Promise.all(
    clipIds.map(
      clipId => sql<{ id: string }>`
      SELECT id
      FROM stream_recordings
      WHERE id = ${clipId}
        AND user_id = ${creatorId}
      LIMIT 1
    `
    )
  );

  return results.every(result => result.rows.length === 1);
}

async function insertCollectionItems(collectionId: string, clipIds: string[]) {
  await Promise.all(
    clipIds.map(
      (clipId, index) => sql`
      INSERT INTO route_f_clip_collection_items (collection_id, clip_id, position)
      VALUES (${collectionId}, ${clipId}, ${index})
    `
    )
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    listCollectionsQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureClipCollectionsSchema();

    const { rows } = await sql`
      SELECT
        c.id,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        u.username AS creator_username,
        COUNT(ci.clip_id)::int AS clip_count
      FROM route_f_clip_collections c
      JOIN users u ON u.id = c.creator_id
      LEFT JOIN route_f_clip_collection_items ci ON ci.collection_id = c.id
      WHERE LOWER(u.username) = LOWER(${queryResult.data.creator})
      GROUP BY c.id, u.username
      ORDER BY c.created_at DESC
    `;

    return NextResponse.json({ collections: rows });
  } catch (error) {
    console.error("[routes-f clips/collections GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch clip collections" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createCollectionSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const clipIds = uniqueClipIds(bodyResult.data.clip_ids ?? []);
  if (clipIds.length !== (bodyResult.data.clip_ids ?? []).length) {
    return NextResponse.json(
      { error: "clip_ids must be unique" },
      { status: 400 }
    );
  }

  try {
    await ensureClipCollectionsSchema();

    const { rows: countRows } = await sql<{ collection_count: number }>`
      SELECT COUNT(*)::int AS collection_count
      FROM route_f_clip_collections
      WHERE creator_id = ${session.userId}
    `;

    if (Number(countRows[0]?.collection_count ?? 0) >= 15) {
      return NextResponse.json(
        { error: "Creators may only have 15 clip collections" },
        { status: 409 }
      );
    }

    if (!(await assertOwnedClips(clipIds, session.userId))) {
      return NextResponse.json(
        { error: "All clips must exist and belong to the creator" },
        { status: 400 }
      );
    }

    const { rows } = await sql<{
      id: string;
      creator_id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>`
      INSERT INTO route_f_clip_collections (creator_id, name, description)
      VALUES (${session.userId}, ${bodyResult.data.name}, ${bodyResult.data.description ?? null})
      RETURNING id, creator_id, name, description, created_at, updated_at
    `;

    await insertCollectionItems(rows[0].id, clipIds);

    return NextResponse.json(
      {
        ...rows[0],
        clip_count: clipIds.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f clips/collections POST]", error);
    return NextResponse.json(
      { error: "Failed to create clip collection" },
      { status: 500 }
    );
  }
}
