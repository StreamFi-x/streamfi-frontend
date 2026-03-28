import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const submitClipSchema = z.object({
  clip_id: z.string().uuid(),
  creator_note: z.string().max(500).optional(),
});

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
  await sql`
    CREATE INDEX IF NOT EXISTS idx_clip_submissions_submitter
    ON clip_submissions (submitter_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_clip_submissions_status
    ON clip_submissions (status, created_at DESC)
  `;
}

/** POST /api/routes-f/clips/submit — submit a clip for featured review */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, submitClipSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { clip_id, creator_note } = bodyResult.data;

  try {
    await ensureSubmissionsTable();

    // Check for existing submission (one per clip)
    const { rows: existing } = await sql`
      SELECT id, status FROM clip_submissions WHERE clip_id = ${clip_id} LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This clip has already been submitted", status: existing[0].status },
        { status: 409 }
      );
    }

    const { rows } = await sql`
      INSERT INTO clip_submissions (clip_id, submitter_id, creator_note)
      VALUES (${clip_id}, ${session.userId}, ${creator_note ?? null})
      RETURNING id, clip_id, submitter_id, creator_note, status, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f clips/submit POST]", error);
    return NextResponse.json({ error: "Failed to submit clip" }, { status: 500 });
  }
}

/** GET /api/routes-f/clips/submit — list own submitted clips and their review status */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    await ensureSubmissionsTable();

    const { rows } = await sql`
      SELECT id, clip_id, creator_note, status, reason, reviewed_at, created_at
      FROM clip_submissions
      WHERE submitter_id = ${session.userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ submissions: rows });
  } catch (error) {
    console.error("[routes-f clips/submit GET]", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}
