import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureMilestonesSchema } from "../_lib/db";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const updateMilestoneSchema = z
  .object({
    target: z.number().positive().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    reward_description: z.string().trim().max(500).nullable().optional(),
  })
  .refine(body => Object.keys(body).length > 0, {
    message: "At least one field is required",
    path: ["body"],
  });

function validateId(id: string): NextResponse | null {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid milestone id" },
      { status: 400 }
    );
  }
  return null;
}

export async function PATCH(
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

  const bodyResult = await validateBody(req, updateMilestoneSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { target, title, reward_description } = bodyResult.data;

  try {
    await ensureMilestonesSchema();

    const { rows } = await sql`
      UPDATE route_f_milestones
      SET target = COALESCE(${target ?? null}, target),
          title = COALESCE(${title ?? null}, title),
          reward_description = CASE
            WHEN ${reward_description !== undefined} THEN ${reward_description ?? null}
            ELSE reward_description
          END,
          updated_at = now()
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      RETURNING id, creator_id, type, target, title, reward_description, completed_at, created_at, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...rows[0],
      target: Number(rows[0].target),
    });
  } catch (error) {
    console.error("[milestones/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    await ensureMilestonesSchema();

    const { rows } = await sql`
      DELETE FROM route_f_milestones
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: rows[0].id, deleted: true });
  } catch (error) {
    console.error("[milestones/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
