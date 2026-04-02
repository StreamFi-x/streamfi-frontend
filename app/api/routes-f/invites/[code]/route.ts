import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureInvitesSchema } from "../_lib/db";

type RouteContext = {
  params: Promise<{ code: string }>;
};

type InviteLookupRow = {
  code: string;
  stream_id: string;
  creator_id: string;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  username: string;
  avatar: string | null;
  is_live: boolean | null;
  creator: {
    streamTitle?: string;
    category?: string;
    tags?: string[];
    description?: string;
  } | null;
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function isCodeUnavailable(invite: {
  revoked_at: string | null;
  expires_at: string | null;
  use_count: number;
  max_uses: number;
}): boolean {
  if (invite.revoked_at) {
    return true;
  }

  if (
    invite.expires_at &&
    new Date(invite.expires_at).getTime() <= Date.now()
  ) {
    return true;
  }

  return invite.use_count >= invite.max_uses;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { code } = await params;
  const normalizedCode = normalizeCode(code);

  if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
  }

  try {
    await ensureInvitesSchema();

    const { rows } = await sql`
      SELECT
        i.code,
        i.stream_id,
        i.creator_id,
        i.max_uses,
        i.use_count,
        i.expires_at,
        i.revoked_at,
        i.created_at,
        u.username,
        u.avatar,
        u.is_live,
        u.creator
      FROM route_f_stream_invites i
      JOIN users u ON u.id = i.stream_id
      WHERE i.code = ${normalizedCode}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const invite = rows[0] as InviteLookupRow;

    if (isCodeUnavailable(invite)) {
      return NextResponse.json(
        { error: "Invite code has expired or been exhausted" },
        { status: 410 }
      );
    }

    const creator = invite.creator ?? {};

    return NextResponse.json({
      code: invite.code,
      remaining_uses: Math.max(invite.max_uses - invite.use_count, 0),
      expires_at: invite.expires_at,
      stream: {
        id: invite.stream_id,
        username: invite.username,
        avatar: invite.avatar,
        is_live: invite.is_live ?? false,
        title: creator.streamTitle ?? "Untitled Stream",
        category: creator.category ?? "",
        tags: creator.tags ?? [],
        description: creator.description ?? "",
      },
    });
  } catch (error) {
    console.error("[invites] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { code } = await params;
  const normalizedCode = normalizeCode(code);

  try {
    await ensureInvitesSchema();

    const { rows } = await sql`
      UPDATE route_f_stream_invites
      SET revoked_at = now(), updated_at = now()
      WHERE code = ${normalizedCode} AND creator_id = ${session.userId}
      RETURNING code
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    return NextResponse.json({ revoked: true, code: normalizedCode });
  } catch (error) {
    console.error("[invites] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
