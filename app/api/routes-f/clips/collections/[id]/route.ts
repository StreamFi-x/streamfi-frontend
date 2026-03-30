import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureClipCollectionsSchema } from "../_lib/db";

const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  clip_ids: z.array(uuidSchema).max(30).optional(),
});

function uniqueClipIds(clipIds: string[]) {
  return [...new Set(clipIds)];
}

async function getCollection(id: string) {
  const { rows } = await sql<{
    id: string;
    creator_id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    creator_username: string;
  }>`
    SELECT
      c.id,
      c.creator_id,
      c.name,
      c.description,
      c.created_at,
      c.updated_at,
      u.username AS creator_username
    FROM route_f_clip_collections c
    JOIN users u ON u.id = c.creator_id
    WHERE c.id = ${id}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getCollectionClips(id: string) {
  const { rows } = await sql`
    SELECT
      i.position,
      r.id,
      r.playback_id,
      r.title,
      r.duration,
      r.view_count,
      r.created_at
    FROM route_f_clip_collection_items i
    JOIN stream_recordings r ON r.id = i.clip_id
    WHERE i.collection_id = ${id}
    ORDER BY i.position ASC
  `;

  return rows;
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

async function replaceCollectionItems(collectionId: string, clipIds: string[]) {
  await sql`
    DELETE FROM route_f_clip_collection_items
    WHERE collection_id = ${collectionId}
  `;

  await Promise.all(
    clipIds.map(
      (clipId, index) => sql`
      INSERT INTO route_f_clip_collection_items (collection_id, clip_id, position)
      VALUES (${collectionId}, ${clipId}, ${index})
    `
    )
  );
}

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(
  _req: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid collection id" },
      { status: 400 }
    );
  }

  try {
    await ensureClipCollectionsSchema();

    const collection = await getCollection(id);
    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...collection,
      clips: await getCollectionClips(id),
    });
  } catch (error) {
    console.error("[routes-f clips/collections/[id] GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch clip collection" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid collection id" },
      { status: 400 }
    );
  }

  const bodyResult = await validateBody(req, updateCollectionSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const clipIds = bodyResult.data.clip_ids
    ? uniqueClipIds(bodyResult.data.clip_ids)
    : null;

  if (
    bodyResult.data.clip_ids &&
    clipIds &&
    clipIds.length !== bodyResult.data.clip_ids.length
  ) {
    return NextResponse.json(
      { error: "clip_ids must be unique" },
      { status: 400 }
    );
  }

  if (
    bodyResult.data.name === undefined &&
    bodyResult.data.description === undefined &&
    bodyResult.data.clip_ids === undefined
  ) {
    return NextResponse.json(
      { error: "At least one field must be provided" },
      { status: 400 }
    );
  }

  try {
    await ensureClipCollectionsSchema();

    const collection = await getCollection(id);
    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    if (collection.creator_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (clipIds && !(await assertOwnedClips(clipIds, session.userId))) {
      return NextResponse.json(
        { error: "All clips must exist and belong to the creator" },
        { status: 400 }
      );
    }

    const nextName = bodyResult.data.name ?? collection.name;
    const nextDescription =
      bodyResult.data.description === undefined
        ? collection.description
        : bodyResult.data.description;

    const { rows } = await sql`
      UPDATE route_f_clip_collections
      SET
        name = ${nextName},
        description = ${nextDescription},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, creator_id, name, description, created_at, updated_at
    `;

    if (clipIds) {
      await replaceCollectionItems(id, clipIds);
    }

    return NextResponse.json({
      ...rows[0],
      clips: await getCollectionClips(id),
    });
  } catch (error) {
    console.error("[routes-f clips/collections/[id] PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update clip collection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid collection id" },
      { status: 400 }
    );
  }

  try {
    await ensureClipCollectionsSchema();

    const { rows } = await sql<{ id: string }>`
      DELETE FROM route_f_clip_collections
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    console.error("[routes-f clips/collections/[id] DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete clip collection" },
      { status: 500 }
    );
  }
}
