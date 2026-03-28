/**
 * GET    /api/routes-f/jobs/[id]  — get job status + result
 * DELETE /api/routes-f/jobs/[id]  — cancel a pending job
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { ensureJobsSchema } from "../_lib/db";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

function validateId(id: string): NextResponse | null {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }
  return null;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
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
    await ensureJobsSchema();

    const { rows } = await sql`
      SELECT id, type, status, payload, result, error, attempts,
             max_attempts, created_at, started_at, completed_at
      FROM jobs
      WHERE id = ${id} AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[jobs/[id]] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

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
    await ensureJobsSchema();

    // Only pending jobs can be cancelled
    const { rows } = await sql`
      UPDATE jobs
      SET status = 'cancelled'
      WHERE id = ${id}
        AND user_id = ${session.userId}
        AND status = 'pending'
      RETURNING id, status
    `;

    if (rows.length === 0) {
      // Either job doesn't exist, doesn't belong to user, or isn't pending
      const { rows: existing } = await sql`
        SELECT id, status FROM jobs
        WHERE id = ${id} AND user_id = ${session.userId}
        LIMIT 1
      `;

      if (existing.length === 0) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: `Cannot cancel a job with status "${existing[0].status}". Only pending jobs can be cancelled.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ id: rows[0].id, status: "cancelled" });
  } catch (err) {
    console.error("[jobs/[id]] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
