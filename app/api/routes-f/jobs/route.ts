/**
 * GET  /api/routes-f/jobs   — list jobs for the current user
 * POST /api/routes-f/jobs   — enqueue a new background job
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { paginationSchema } from "@/app/api/routes-f/_lib/schemas";
import { ensureJobsSchema, JOB_TYPES, type JobType } from "./_lib/db";

const enqueueBodySchema = z.object({
  type: z
    .string()
    .refine(
      (v): v is JobType => JOB_TYPES.has(v as JobType),
      `type must be one of: ${[...JOB_TYPES].join(", ")}`
    ),
  payload: z.record(z.unknown()).optional(),
  max_attempts: z.number().int().min(1).max(10).optional(),
});

const listQuerySchema = paginationSchema.extend({
  status: z
    .enum(["pending", "running", "completed", "failed", "cancelled"])
    .optional(),
});

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, listQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { limit, cursor, status } = queryResult.data;

  try {
    await ensureJobsSchema();

    let rows: unknown[];

    if (cursor && status) {
      ({ rows } = await sql`
        SELECT id, type, status, payload, result, error, attempts,
               max_attempts, created_at, started_at, completed_at
        FROM jobs
        WHERE user_id = ${session.userId}
          AND status = ${status}
          AND created_at < (SELECT created_at FROM jobs WHERE id = ${cursor} LIMIT 1)
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
    } else if (cursor) {
      ({ rows } = await sql`
        SELECT id, type, status, payload, result, error, attempts,
               max_attempts, created_at, started_at, completed_at
        FROM jobs
        WHERE user_id = ${session.userId}
          AND created_at < (SELECT created_at FROM jobs WHERE id = ${cursor} LIMIT 1)
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
    } else if (status) {
      ({ rows } = await sql`
        SELECT id, type, status, payload, result, error, attempts,
               max_attempts, created_at, started_at, completed_at
        FROM jobs
        WHERE user_id = ${session.userId}
          AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
    } else {
      ({ rows } = await sql`
        SELECT id, type, status, payload, result, error, attempts,
               max_attempts, created_at, started_at, completed_at
        FROM jobs
        WHERE user_id = ${session.userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
    }

    const nextCursor =
      rows.length === limit
        ? (rows[rows.length - 1] as { id: string }).id
        : null;

    return NextResponse.json({ jobs: rows, next_cursor: nextCursor });
  } catch (err) {
    console.error("[jobs] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, enqueueBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { type, payload = {}, max_attempts = 3 } = bodyResult.data;

  try {
    await ensureJobsSchema();

    const { rows } = await sql`
      INSERT INTO jobs (user_id, type, payload, max_attempts)
      VALUES (${session.userId}, ${type}, ${JSON.stringify(payload)}, ${max_attempts})
      RETURNING id, type, status, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[jobs] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
