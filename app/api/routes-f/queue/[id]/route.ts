import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const updateQueueSchema = z
  .object({
    title: z.string().min(1).max(160).optional(),
    scheduled_at: z.coerce.date().optional(),
    category: z.string().min(1).max(80).optional(),
    description: z.string().max(2000).nullable().optional(),
  })
  .refine(
    body =>
      body.title !== undefined ||
      body.scheduled_at !== undefined ||
      body.category !== undefined ||
      body.description !== undefined,
    "At least one field is required"
  );

async function ensureQueueTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_stream_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function hasOverlap(
  creatorId: string,
  scheduledAt: Date,
  excludeId: string
) {
  const { rows } = await sql`
    SELECT 1
    FROM creator_stream_queue
    WHERE creator_id = ${creatorId}
      AND id != ${excludeId}
      AND ABS(EXTRACT(EPOCH FROM (scheduled_at - ${scheduledAt.toISOString()}::timestamptz))) < 1800
    LIMIT 1
  `;

  return rows.length > 0;
}

async function upcomingCount(creatorId: string, excludeId: string) {
  const { rows } = await sql`
    SELECT COUNT(*)::int AS total
    FROM creator_stream_queue
    WHERE creator_id = ${creatorId}
      AND id != ${excludeId}
      AND scheduled_at > NOW()
  `;

  return Number(rows[0]?.total ?? 0);
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
  const bodyResult = await validateBody(req, updateQueueSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureQueueTable();

    const { rows: existingRows } = await sql`
      SELECT id, title, scheduled_at, category, description
      FROM creator_stream_queue
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      LIMIT 1
    `;

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: "Scheduled stream not found" },
        { status: 404 }
      );
    }

    const current = existingRows[0];
    const scheduledAt =
      bodyResult.data.scheduled_at ?? new Date(current.scheduled_at as string);

    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "scheduled_at must be in the future" },
        { status: 400 }
      );
    }

    const nextCount = await upcomingCount(session.userId, id);
    if (nextCount >= 10) {
      return NextResponse.json(
        { error: "Maximum of 10 upcoming scheduled streams reached" },
        { status: 400 }
      );
    }

    if (await hasOverlap(session.userId, scheduledAt, id)) {
      return NextResponse.json(
        { error: "Scheduled stream overlaps with an existing slot" },
        { status: 409 }
      );
    }

    const title = bodyResult.data.title ?? (current.title as string);
    const category = bodyResult.data.category ?? (current.category as string);
    const description =
      bodyResult.data.description !== undefined
        ? bodyResult.data.description
        : (current.description as string | null);

    const { rows } = await sql`
      UPDATE creator_stream_queue
      SET
        title = ${title},
        scheduled_at = ${scheduledAt.toISOString()},
        category = ${category},
        description = ${description},
        updated_at = NOW()
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      RETURNING id, title, scheduled_at, category, description, created_at, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[queue/:id] PATCH error:", err);
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
    await ensureQueueTable();

    const { rowCount } = await sql`
      DELETE FROM creator_stream_queue
      WHERE id = ${id}
        AND creator_id = ${session.userId}
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Scheduled stream not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Scheduled stream cancelled" });
  } catch (err) {
    console.error("[queue/:id] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
