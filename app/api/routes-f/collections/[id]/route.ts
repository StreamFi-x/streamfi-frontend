import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { ensureCollectionsSchema } from "../_lib/db";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

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

export async function DELETE(
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

  try {
    await ensureCollectionsSchema();

    const { rows } = await sql`
      DELETE FROM route_f_collections
      WHERE id = ${id}
        AND user_id = ${session.userId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: rows[0].id, deleted: true });
  } catch (error) {
    console.error("[collections/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
