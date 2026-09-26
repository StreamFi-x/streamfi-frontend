/**
 * PATCH /api/admin/category-requests/[id] — approve, reject, or merge (#1429)
 *
 * approve: creates a row in stream_categories (the same table every existing
 *   category lives in) and links it back onto the request.
 * reject: requires a reason, surfaced to the requester.
 * merge: links the request to an existing category id and appends the
 *   proposed title as a tag on that category, so the name remains
 *   discoverable via the existing tag search without a duplicate category.
 *
 * All three are one-shot: a request already decided cannot be redecided
 * (optimistic check on status = 'pending'), so two admins reviewing the same
 * request race safely — the second gets a 409, not a silent double-apply.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { requireAdminIdentity } from "@/lib/admin-auth";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { withTransaction } from "@/lib/postgres-transaction";
import { invalidateCategoryCaches } from "@/lib/cache/invalidation";
import { recordWorkflowEvent } from "@/lib/audit/workflow-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({
    decision: z.literal("reject"),
    reason: z.string().trim().min(5).max(500),
  }),
  z.object({
    decision: z.literal("merge"),
    categoryId: z.string().uuid(),
  }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireAdminIdentity(
    "admin/category-requests/[id]"
  );
  if (response) {
    return response;
  }
  const { id } = await params;

  const bodyResult = await validateBody(req, decisionSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }
  const decision = bodyResult.data;

  const { rows: existing } = await sql`
    SELECT id, proposed_title, status FROM category_requests WHERE id = ${id}
  `;
  if (!existing[0]) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing[0].status !== "pending") {
    return NextResponse.json(
      { error: `Request already ${existing[0].status}` },
      { status: 409 }
    );
  }
  const proposedTitle = existing[0].proposed_title as string;

  try {
    const result = await withTransaction(async tx => {
      if (decision.decision === "approve") {
        const { rows: category } = await tx.sql`
          INSERT INTO stream_categories (title)
          VALUES (${proposedTitle})
          ON CONFLICT (title) DO NOTHING
          RETURNING id
        `;
        if (category.length === 0) {
          throw new CategoryConflictError();
        }
        const { rows } = await tx.sql`
          UPDATE category_requests
          SET status = 'approved', reviewed_by = ${admin}, reviewed_at = now(),
              category_id = ${category[0].id}, updated_at = now()
          WHERE id = ${id} AND status = 'pending'
          RETURNING id, status, category_id
        `;
        if (rows.length === 0) {
          throw new AlreadyDecidedError();
        }
        return rows[0];
      }

      if (decision.decision === "reject") {
        const { rows } = await tx.sql`
          UPDATE category_requests
          SET status = 'rejected', reviewed_by = ${admin}, reviewed_at = now(),
              decision_reason = ${decision.reason}, updated_at = now()
          WHERE id = ${id} AND status = 'pending'
          RETURNING id, status
        `;
        if (rows.length === 0) {
          throw new AlreadyDecidedError();
        }
        return rows[0];
      }

      // merge
      const { rows: targetCategory } = await tx.sql`
        SELECT id, tags FROM stream_categories WHERE id = ${decision.categoryId}
      `;
      if (!targetCategory[0]) {
        throw new TargetNotFoundError();
      }
      const existingTags: string[] = targetCategory[0].tags ?? [];
      if (!existingTags.some(t => t.toLowerCase() === proposedTitle.toLowerCase())) {
        await tx.sql`
          UPDATE stream_categories
          SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), ${proposedTitle})
          WHERE id = ${decision.categoryId}
        `;
      }
      const { rows } = await tx.sql`
        UPDATE category_requests
        SET status = 'merged', reviewed_by = ${admin}, reviewed_at = now(),
            category_id = ${decision.categoryId}, updated_at = now()
        WHERE id = ${id} AND status = 'pending'
        RETURNING id, status, category_id
      `;
      if (rows.length === 0) {
        throw new AlreadyDecidedError();
      }
      return rows[0];
    });

    await invalidateCategoryCaches();
    await recordWorkflowEvent({
      workflow: "category_request",
      subjectId: id,
      action: decision.decision,
      actorType: "admin",
      actorId: admin,
      fromState: "pending",
      toState: result.status,
      reason: decision.decision === "reject" ? decision.reason : null,
      metadata:
        decision.decision === "merge"
          ? { categoryId: decision.categoryId }
          : {},
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AlreadyDecidedError) {
      return NextResponse.json(
        { error: "Request was already decided by another reviewer" },
        { status: 409 }
      );
    }
    if (err instanceof CategoryConflictError) {
      return NextResponse.json(
        { error: "A category with this title already exists" },
        { status: 409 }
      );
    }
    if (err instanceof TargetNotFoundError) {
      return NextResponse.json(
        { error: "Merge target category not found" },
        { status: 404 }
      );
    }
    throw err;
  }
}

class AlreadyDecidedError extends Error {}
class CategoryConflictError extends Error {}
class TargetNotFoundError extends Error {}
