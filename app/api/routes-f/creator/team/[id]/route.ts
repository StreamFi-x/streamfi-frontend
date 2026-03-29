import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const TEAM_ROLES = ["moderator", "editor"] as const;

const updateTeamRoleSchema = z.object({
  role: z.enum(TEAM_ROLES),
});

async function ensureCreatorTeamSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_creator_team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('moderator', 'editor')),
      status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
      invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (creator_id, member_id)
    )
  `;
}

function validateId(id: string): NextResponse | null {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid team member id" }, { status: 400 });
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

  const bodyResult = await validateBody(req, updateTeamRoleSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureCreatorTeamSchema();

    const { rows } = await sql`
      UPDATE route_f_creator_team_members
      SET role = ${bodyResult.data.role}, updated_at = NOW()
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      RETURNING id, creator_id, member_id, role, status, invited_at, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[routes-f creator/team/[id] PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update team member role" },
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
    await ensureCreatorTeamSchema();

    const { rows } = await sql`
      DELETE FROM route_f_creator_team_members
      WHERE id = ${id}
        AND creator_id = ${session.userId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: rows[0].id,
      deleted: true,
    });
  } catch (error) {
    console.error("[routes-f creator/team/[id] DELETE]", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
