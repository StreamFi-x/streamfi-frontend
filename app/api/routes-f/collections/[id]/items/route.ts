import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { COLLECTION_ITEM_TYPES, ensureCollectionsSchema } from "../../_lib/db";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const addCollectionItemSchema = z.object({
  item_id: uuidSchema,
  item_type: z.enum(COLLECTION_ITEM_TYPES),
});

function validateId(id: string): NextResponse | null {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid collection id" },
      { status: 400 }
    );
  }
  return null;
}

export async function POST(
  req: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await context.params;

  const idError = validateId(id);
  if (idError) {
    return idError;
  }

  const bodyResult = await validateBody(req, addCollectionItemSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { item_id, item_type } = bodyResult.data;

  try {
    await ensureCollectionsSchema();

    const { rows: ownerRows } = await sql`
      SELECT id
      FROM route_f_collections
      WHERE id = ${id}
        AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (ownerRows.length === 0) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS item_count
      FROM route_f_collection_items
      WHERE collection_id = ${id}
    `;

    if (Number(countRows[0]?.item_count ?? 0) >= 50) {
      return NextResponse.json(
        { error: "Collections may only contain 50 items" },
        { status: 409 }
      );
    }

    const { rows: itemRows } = await sql`
      SELECT id, title, playback_id, status
      FROM stream_recordings
      WHERE id = ${item_id}
      LIMIT 1
    `;

    if (itemRows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { rows } = await sql`
      INSERT INTO route_f_collection_items (collection_id, item_id, item_type)
      VALUES (${id}, ${item_id}, ${item_type})
      ON CONFLICT (collection_id, item_id, item_type) DO NOTHING
      RETURNING collection_id, item_id, item_type, created_at
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Item already exists in this collection" },
        { status: 409 }
      );
    }

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[collections/[id]/items] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
