import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const TEAM_ROLES = ["moderator", "editor"] as const;

const inviteTeamMemberSchema = z.object({
  username: usernameSchema,
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureCreatorTeamSchema();

    const { rows } = await sql`
      SELECT
        tm.id,
        tm.member_id,
        u.username,
        u.avatar,
        tm.role,
        tm.status,
        tm.invited_at,
        tm.updated_at
      FROM route_f_creator_team_members tm
      JOIN users u ON u.id = tm.member_id
      WHERE tm.creator_id = ${session.userId}
      ORDER BY tm.invited_at DESC
    `;

    return NextResponse.json({
      team: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("[routes-f creator/team GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creator team" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, inviteTeamMemberSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { username, role } = bodyResult.data;

  try {
    await ensureCreatorTeamSchema();

    const { rows: sizeRows } = await sql`
      SELECT COUNT(*)::int AS team_size
      FROM route_f_creator_team_members
      WHERE creator_id = ${session.userId}
    `;

    if (Number(sizeRows[0]?.team_size ?? 0) >= 10) {
      return NextResponse.json(
        { error: "A creator can have at most 10 team members" },
        { status: 409 }
      );
    }

    const { rows: userRows } = await sql`
      SELECT id, username, avatar
      FROM users
      WHERE LOWER(username) = LOWER(${username})
      LIMIT 1
    `;

    if (userRows.length === 0) {
      return NextResponse.json(
        { error: "Invited user does not exist" },
        { status: 404 }
      );
    }

    const invitedUser = userRows[0];
    if (String(invitedUser.id) === session.userId) {
      return NextResponse.json(
        { error: "You cannot invite yourself" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      INSERT INTO route_f_creator_team_members (
        creator_id,
        member_id,
        role,
        status
      )
      VALUES (
        ${session.userId},
        ${invitedUser.id},
        ${role},
        'invited'
      )
      ON CONFLICT (creator_id, member_id) DO NOTHING
      RETURNING id, creator_id, member_id, role, status, invited_at, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "User is already in the creator team" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ...rows[0],
        member: {
          username: invitedUser.username,
          avatar: invitedUser.avatar,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f creator/team POST]", error);
    return NextResponse.json(
      { error: "Failed to invite team member" },
      { status: 500 }
    );
  }
}
