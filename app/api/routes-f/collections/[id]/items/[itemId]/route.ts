import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { ensureCollectionsSchema } from "../../../_lib/db";

interface RouteParams {
  params:
    | Promise<{ id: string; itemId: string }>
    | { id: string; itemId: string };
}

function validateId(id: string, label: string): NextResponse | null {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return NextResponse.json({ error: `Invalid ${label}` }, { status: 400 });
  }
  return null;
}

export async function DELETE(
  req: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id, itemId } = await context.params;

  const collectionIdError = validateId(id, "collection id");
  if (collectionIdError) {
    return collectionIdError;
  }

  const itemIdError = validateId(itemId, "item id");
  if (itemIdError) {
    return itemIdError;
  }

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

    const { rows } = await sql`
      DELETE FROM route_f_collection_items
      WHERE collection_id = ${id}
        AND item_id = ${itemId}
      RETURNING item_id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Collection item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item_id: rows[0].item_id, deleted: true });
  } catch (error) {
    console.error("[collections/[id]/items/[itemId]] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
