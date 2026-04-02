import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function ensureSubmissionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS clip_submissions (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      clip_id       UUID        NOT NULL,
      submitter_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_note  TEXT,
      status        VARCHAR(20) NOT NULL DEFAULT 'pending',
      reason        TEXT,
      reviewed_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at   TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (clip_id)
    )
  `;
}

async function assertAdmin(userId: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows.length > 0 && rows[0].is_admin === true;
}

/** GET /api/routes-f/clips/submit/admin — admin lists all pending submissions */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    await ensureSubmissionsTable();

    const isAdmin = await assertAdmin(session.userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "pending";

    const { rows } = await sql`
      SELECT
        cs.id,
        cs.clip_id,
        cs.submitter_id,
        cs.creator_note,
        cs.status,
        cs.reason,
        cs.reviewed_by,
        cs.reviewed_at,
        cs.created_at,
        u.username AS submitter_username
      FROM clip_submissions cs
      LEFT JOIN users u ON u.id = cs.submitter_id
      WHERE cs.status = ${status}
      ORDER BY cs.created_at ASC
    `;

    return NextResponse.json({ submissions: rows });
  } catch (error) {
    console.error("[routes-f clips/submit/admin GET]", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}
