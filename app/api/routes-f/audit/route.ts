import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

async function ensureAuditTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id),
      actor_id    UUID REFERENCES users(id),
      event_type  TEXT NOT NULL,
      metadata    JSONB,
      ip_address  INET,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS audit_logs_user
    ON audit_logs(user_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS audit_logs_type
    ON audit_logs(event_type, created_at DESC)
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

const querySchema = z.object({
  user: z.string().optional(),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const result = validateQuery(new URL(req.url).searchParams, querySchema);
  if (result instanceof NextResponse) return result;
  const { user, type, from, to, limit, cursor } = result.data;
  const pageLimit = limit ?? 50;

  await ensureAuditTable();

  const fromDate = from ? new Date(from).toISOString() : null;
  const toDate = to ? new Date(to).toISOString() : null;
  const cursorDate = cursor ? new Date(cursor).toISOString() : null;

  const { rows: events } = await sql`
    SELECT
      al.id,
      al.event_type,
      al.metadata,
      al.ip_address,
      al.user_agent,
      al.created_at,
      u.username  AS subject_username,
      a.username  AS actor_username
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    LEFT JOIN users a ON a.id = al.actor_id
    WHERE (${user ?? null}::text IS NULL OR u.username = ${user ?? null})
      AND (${type ?? null}::text IS NULL OR al.event_type = ${type ?? null})
      AND (${fromDate ?? null}::timestamptz IS NULL OR al.created_at >= ${fromDate ?? null})
      AND (${toDate ?? null}::timestamptz IS NULL OR al.created_at <= ${toDate ?? null})
      AND (${cursorDate ?? null}::timestamptz IS NULL OR al.created_at < ${cursorDate ?? null})
    ORDER BY al.created_at DESC
    LIMIT ${pageLimit + 1}
  `;

  const hasMore = events.length > pageLimit;
  const page = hasMore ? events.slice(0, pageLimit) : events;
  const nextCursor = hasMore ? page[page.length - 1].created_at : null;

  const { rows: countRows } = await sql`
    SELECT COUNT(*) AS total
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE (${user ?? null}::text IS NULL OR u.username = ${user ?? null})
      AND (${type ?? null}::text IS NULL OR al.event_type = ${type ?? null})
      AND (${fromDate ?? null}::timestamptz IS NULL OR al.created_at >= ${fromDate ?? null})
      AND (${toDate ?? null}::timestamptz IS NULL OR al.created_at <= ${toDate ?? null})
  `;

  return NextResponse.json({
    events: page.map(e => ({
      id: e.id,
      event_type: e.event_type,
      user: e.subject_username ? { username: e.subject_username } : null,
      actor: e.actor_username ? { username: e.actor_username } : null,
      metadata: e.metadata,
      ip_address: e.ip_address,
      created_at: e.created_at,
    })),
    total: Number(countRows[0]?.total ?? 0),
    next_cursor: nextCursor,
  });
}
