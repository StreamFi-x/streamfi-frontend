import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

async function ensureStreamGoalsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_stream_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('tip_amount', 'new_subs', 'viewer_count')),
      target NUMERIC(20, 7) NOT NULL CHECK (target > 0),
      title VARCHAR(160) NOT NULL,
      completed_at TIMESTAMPTZ,
      stream_started_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function validateId(id: string): NextResponse | null {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid goal id" }, { status: 400 });
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
    await ensureStreamGoalsSchema();

    const { rows: goalRows } = await sql`
      SELECT id, creator_id
      FROM route_f_stream_goals
      WHERE id = ${id}
      LIMIT 1
    `;

    if (goalRows.length === 0) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    if (String(goalRows[0].creator_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`
      DELETE FROM route_f_stream_goals
      WHERE id = ${id}
    `;

    return NextResponse.json({
      id,
      deleted: true,
    });
  } catch (error) {
    console.error("[routes-f stream/goals/[id] DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete stream goal" },
      { status: 500 }
    );
  }
}
