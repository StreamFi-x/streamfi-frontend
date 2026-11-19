/**
 * POST /api/routes-f/category-requests — creator submits a proposed category
 * GET  /api/routes-f/category-requests — the caller's own requests
 *
 * Approval creates a row in the existing stream_categories table (see
 * app/api/category/route.ts) — approved categories are selected through the
 * exact same mechanism every other category uses, not a parallel path.
 *
 * Duplicate/near-duplicate detection: proposed_title is normalized (case,
 * accents, punctuation/whitespace — lib/categories/normalize.ts) and a
 * partial unique index allows only one *pending* request per normalized key,
 * so "Speedrunning" and "Speed Running" collide. It does not compare against
 * existing approved categories' near-duplicates automatically — that
 * decision is left to the admin reviewer (see category-requests/[id]/review),
 * who is shown the closest existing categories to decide.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { normalizeCategoryKey } from "@/lib/categories/normalize";
import { recordWorkflowEvent } from "@/lib/audit/workflow-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const submitSchema = z.object({
  title: z.string().trim().min(2).max(50),
  rationale: z.string().trim().min(20).max(1000),
});

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, submitSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }
  const { title, rationale } = bodyResult.data;
  const normalizedKey = normalizeCategoryKey(title);
  if (!normalizedKey) {
    return NextResponse.json(
      { error: "Category name must contain at least one letter or digit" },
      { status: 400 }
    );
  }

  // Already an existing, approved category under the same normalized name —
  // no need to request it.
  const { rows: existingCategoryRows } = await sql`
    SELECT id, title FROM stream_categories WHERE LOWER(title) = LOWER(${title})
  `;
  if (existingCategoryRows.length > 0) {
    return NextResponse.json(
      {
        error: "This category already exists",
        category: existingCategoryRows[0],
      },
      { status: 409 }
    );
  }

  try {
    const { rows } = await sql`
      INSERT INTO category_requests (requested_by, proposed_title, normalized_key, rationale)
      VALUES (${session.userId}, ${title}, ${normalizedKey}, ${rationale})
      RETURNING id, status, created_at
    `;
    const created = rows[0];

    await recordWorkflowEvent({
      workflow: "category_request",
      subjectId: created.id,
      action: "submit",
      actorType: "user",
      actorId: session.userId,
      fromState: null,
      toState: "pending",
      reason: rationale,
      metadata: { proposedTitle: title },
    });

    return NextResponse.json(
      { requestId: created.id, status: created.status, createdAt: created.created_at },
      { status: 201 }
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      const { rows } = await sql`
        SELECT id, status FROM category_requests
        WHERE normalized_key = ${normalizedKey} AND status = 'pending'
        LIMIT 1
      `;
      return NextResponse.json(
        {
          error: "A similar category request is already pending review",
          requestId: rows[0]?.id,
          status: rows[0]?.status,
        },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { rows } = await sql`
    SELECT id, proposed_title, rationale, status, decision_reason,
           reviewed_at, category_id, created_at
    FROM category_requests
    WHERE requested_by = ${session.userId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ requests: rows });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
