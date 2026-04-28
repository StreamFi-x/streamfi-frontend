import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const existing = await sql`
      SELECT creator_id FROM stream_schedule WHERE id = ${id}::uuid LIMIT 1
    `;

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "Scheduled stream not found" },
        { status: 404 }
      );
    }

    if (String(existing.rows[0].creator_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scheduledAt = body.scheduled_at
      ? new Date(String(body.scheduled_at))
      : null;

    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { error: "scheduled_at must be a valid ISO timestamp" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE stream_schedule
      SET title = COALESCE(${body.title ? String(body.title).trim() : null}, title),
          description = COALESCE(${body.description ? String(body.description) : null}, description),
          category = COALESCE(${body.category ? String(body.category) : null}, category),
          scheduled_at = COALESCE(${scheduledAt?.toISOString() ?? null}, scheduled_at),
          duration_mins = COALESCE(${body.duration_mins ? Number.parseInt(String(body.duration_mins), 10) : null}, duration_mins),
          status = COALESCE(${body.status ? String(body.status) : null}, status),
          updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, title, description, category, scheduled_at, duration_mins, status, created_at, updated_at
    `;

    return NextResponse.json({ schedule: result.rows[0] });
  } catch (error) {
    console.error("[routes-f schedule PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update scheduled stream" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    const existing = await sql`
      SELECT creator_id FROM stream_schedule WHERE id = ${id}::uuid LIMIT 1
    `;

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "Scheduled stream not found" },
        { status: 404 }
      );
    }

    if (String(existing.rows[0].creator_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`
      UPDATE stream_schedule
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[routes-f schedule DELETE]", error);
    return NextResponse.json(
      { error: "Failed to cancel scheduled stream" },
      { status: 500 }
    );
  }
}
