import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { COLLECTION_VISIBILITIES, ensureCollectionsSchema } from "./_lib/db";

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  visibility: z.enum(COLLECTION_VISIBILITIES),
});

const publicCollectionsQuerySchema = z.object({
  creator: usernameSchema.optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, publicCollectionsQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureCollectionsSchema();

    if (queryResult.data.creator) {
      const { rows } = await sql`
        SELECT
          c.id,
          c.name,
          c.visibility,
          c.created_at,
          c.updated_at,
          u.username,
          COUNT(ci.item_id)::int AS item_count
        FROM route_f_collections c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN route_f_collection_items ci ON ci.collection_id = c.id
        WHERE LOWER(u.username) = LOWER(${queryResult.data.creator})
          AND c.visibility = 'public'
        GROUP BY c.id, u.username
        ORDER BY c.created_at DESC
      `;

      return NextResponse.json({ collections: rows });
    }

    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const { rows } = await sql`
      SELECT
        c.id,
        c.name,
        c.visibility,
        c.created_at,
        c.updated_at,
        COUNT(ci.item_id)::int AS item_count
      FROM route_f_collections c
      LEFT JOIN route_f_collection_items ci ON ci.collection_id = c.id
      WHERE c.user_id = ${session.userId}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    return NextResponse.json({ collections: rows });
  } catch (error) {
    console.error("[collections] GET error:", error);
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

  const bodyResult = await validateBody(req, createCollectionSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { name, visibility } = bodyResult.data;

  try {
    await ensureCollectionsSchema();

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS collection_count
      FROM route_f_collections
      WHERE user_id = ${session.userId}
    `;

    if (Number(countRows[0]?.collection_count ?? 0) >= 20) {
      return NextResponse.json(
        { error: "Users may only have 20 collections" },
        { status: 409 }
      );
    }

    const { rows } = await sql`
      INSERT INTO route_f_collections (user_id, name, visibility)
      VALUES (${session.userId}, ${name}, ${visibility})
      RETURNING id, user_id, name, visibility, created_at, updated_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[collections] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
