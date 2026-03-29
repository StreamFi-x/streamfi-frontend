import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

const FEEDBACK_TYPES = ["bug", "feature_request", "general", "nps"] as const;
const MAX_SUBMISSIONS_PER_DAY = 5;

async function ensureFeedbackTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id),
      type        TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'general', 'nps')),
      subject     TEXT,
      body        TEXT NOT NULL,
      rating      INT CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
      page_url    TEXT,
      user_agent  TEXT,
      metadata    JSONB,
      status      TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'actioned', 'dismissed')),
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `;
}

const submitFeedbackSchema = z
  .object({
    type: z.enum(FEEDBACK_TYPES),
    subject: z.string().trim().max(255).optional(),
    body: z.string().trim().min(1),
    rating: z.number().int().min(0).max(10).nullable().optional(),
    page_url: z.string().max(1000).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (d) => d.type !== "nps" || (d.rating !== null && d.rating !== undefined),
    { message: "rating is required for nps type", path: ["rating"] }
  );

const listFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES).optional(),
  status: z
    .enum(["new", "read", "actioned", "dismissed"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

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

/** Public — submit feedback (anonymous submissions supported). */
export async function POST(req: NextRequest): Promise<Response> {
  // Attempt auth but don't require it (anonymous allowed)
  const session = await verifySession(req);
  const userId = session.ok ? session.userId : null;

  const result = await validateBody(req, submitFeedbackSchema);
  if (result instanceof NextResponse) return result;
  const { type, subject, body, rating, page_url, metadata } = result.data;

  await ensureFeedbackTable();

  // Rate limit: 5 submissions per user per 24h (skip for anonymous)
  if (userId) {
    const { rows: rateRows } = await sql`
      SELECT COUNT(*) AS count
      FROM feedback
      WHERE user_id = ${userId}
        AND created_at >= NOW() - INTERVAL '24 hours'
    `;
    if (Number(rateRows[0]?.count ?? 0) >= MAX_SUBMISSIONS_PER_DAY) {
      return NextResponse.json(
        { error: "Rate limit reached. Maximum 5 submissions per 24 hours." },
        { status: 429 }
      );
    }
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  const { rows } = await sql`
    INSERT INTO feedback (user_id, type, subject, body, rating, page_url, user_agent, metadata)
    VALUES (
      ${userId},
      ${type},
      ${subject ?? null},
      ${body},
      ${rating ?? null},
      ${page_url ?? null},
      ${userAgent},
      ${metadata ? JSON.stringify(metadata) : null}
    )
    RETURNING id, type, status, created_at
  `;

  return NextResponse.json({ feedback: rows[0] }, { status: 201 });
}

/** Admin only — list feedback submissions with pagination. */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const result = validateQuery(new URL(req.url).searchParams, listFeedbackSchema);
  if (result instanceof NextResponse) return result;
  const { type, status, page, limit } = result.data;

  await ensureFeedbackTable();

  const offset = (page - 1) * limit;

  const { rows } = await sql`
    SELECT
      f.id, f.type, f.subject, f.body, f.rating, f.page_url,
      f.status, f.created_at, u.username
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    WHERE (${type ?? null}::text IS NULL OR f.type = ${type ?? null})
      AND (${status ?? null}::text IS NULL OR f.status = ${status ?? null})
    ORDER BY f.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const { rows: countRows } = await sql`
    SELECT COUNT(*) AS total
    FROM feedback
    WHERE (${type ?? null}::text IS NULL OR type = ${type ?? null})
      AND (${status ?? null}::text IS NULL OR status = ${status ?? null})
  `;

  return NextResponse.json({
    items: rows,
    total: Number(countRows[0]?.total ?? 0),
    page,
    limit,
  });
}
