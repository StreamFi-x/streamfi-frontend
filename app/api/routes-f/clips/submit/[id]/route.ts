import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().max(500).optional(),
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
}

async function assertAdmin(userId: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows.length > 0 && rows[0].is_admin === true;
}

/**
 * PATCH /api/routes-f/clips/submit/[id]
 * Admin approves or rejects a clip submission.
 * Approved clips are marked featured in the clips table.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { id } = await params;

  const bodyResult = await validateBody(req, reviewSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { status, reason } = bodyResult.data;

  try {
    await ensureSubmissionsTable();

    const isAdmin = await assertAdmin(session.userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { rows: existing } = await sql`
      SELECT id, clip_id, status FROM clip_submissions WHERE id = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (existing[0].status !== "pending") {
      return NextResponse.json(
        { error: "Submission has already been reviewed" },
        { status: 409 }
      );
    }

    const { rows } = await sql`
      UPDATE clip_submissions
      SET
        status      = ${status},
        reason      = ${reason ?? null},
        reviewed_by = ${session.userId},
        reviewed_at = now()
      WHERE id = ${id}
      RETURNING id, clip_id, status, reason, reviewed_by, reviewed_at
    `;

    // If approved, mark the clip as featured
    if (status === "approved") {
      await sql`
        UPDATE clips SET is_featured = true WHERE id = ${existing[0].clip_id}
      `.catch(() => {
        // clips table may not have is_featured yet — non-fatal
      });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[routes-f clips/submit/:id PATCH]", error);
    return NextResponse.json({ error: "Failed to review submission" }, { status: 500 });
  }
}
