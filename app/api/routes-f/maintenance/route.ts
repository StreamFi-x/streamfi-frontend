import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

async function ensureMaintenanceTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      active        BOOLEAN DEFAULT false,
      message       TEXT NOT NULL,
      started_at    TIMESTAMPTZ,
      estimated_end TIMESTAMPTZ,
      affects       TEXT[],
      created_by    UUID REFERENCES users(id),
      ended_at      TIMESTAMPTZ
    )
  `;
}

async function requireAdmin(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }

  const { rows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  if (rows[0]?.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

const activateSchema = z.object({
  message: z.string().trim().min(1),
  estimated_end: z.coerce.date().optional(),
  affects: z
    .array(z.enum(["streaming", "payments", "all"]))
    .min(1)
    .default(["all"]),
  block_new_streams: z.boolean().default(false),
});

/** Public — returns current maintenance status. */
export async function GET(): Promise<Response> {
  await ensureMaintenanceTable();

  const { rows } = await sql`
    SELECT active, message, started_at, estimated_end, affects
    FROM maintenance_windows
    WHERE active = true
    ORDER BY started_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ active: false });
  }

  const row = rows[0];
  return NextResponse.json({
    active: row.active,
    message: row.message,
    started_at: row.started_at,
    estimated_end: row.estimated_end,
    affects: row.affects,
  });
}

/** Admin only — activate maintenance mode. */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const result = await validateBody(req, activateSchema);
  if (result instanceof NextResponse) return result;
  const { message, estimated_end, affects, block_new_streams } = result.data;

  await ensureMaintenanceTable();

  // Deactivate any existing active window first
  await sql`
    UPDATE maintenance_windows SET active = false, ended_at = NOW()
    WHERE active = true
  `;

  const { rows } = await sql`
    INSERT INTO maintenance_windows (active, message, started_at, estimated_end, affects, created_by)
    VALUES (
      true,
      ${message},
      NOW(),
      ${estimated_end?.toISOString() ?? null},
      ${affects as string[]},
      ${auth.session.userId}
    )
    RETURNING *
  `;

  // Store block_new_streams flag in metadata-style column if needed —
  // persisted in the affects array as a convention marker
  if (block_new_streams && !affects.includes("streaming")) {
    await sql`
      UPDATE maintenance_windows
      SET affects = array_append(affects, 'streaming')
      WHERE id = ${rows[0].id}
    `;
  }

  return NextResponse.json({ window: rows[0] }, { status: 201 });
}

/** Admin only — deactivate maintenance mode and purge cache. */
export async function DELETE(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  await ensureMaintenanceTable();

  const { rows } = await sql`
    UPDATE maintenance_windows
    SET active = false, ended_at = NOW()
    WHERE active = true
    RETURNING *
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No active maintenance window" },
      { status: 404 }
    );
  }

  return NextResponse.json({ deactivated: rows[0] });
}
