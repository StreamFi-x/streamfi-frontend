import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const blockActionSchema = z.object({
  target_id: z.string().trim().min(1, "target_id is required"),
  action: z.enum(["block", "mute"]),
  duration_minutes: z.number().int().positive().nullable().optional(),
});

async function ensureBlocklistTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS user_blocklist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('block', 'mute')),
      duration_minutes INT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, target_id, action)
    )
  `;
}

/**
 * GET /api/routes-f/blocklist
 * List blocked/muted users for the authenticated user.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  await ensureBlocklistTable();

  const { rows } = await sql`
    SELECT target_id, action, duration_minutes, expires_at, created_at
    FROM user_blocklist
    WHERE user_id = ${session.userId}
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ blocklist: rows });
}

/**
 * POST /api/routes-f/blocklist
 * Block or mute a user.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const parsed = await validateBody(req, blockActionSchema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const { data } = parsed;

  if (data.target_id === session.userId) {
    return NextResponse.json(
      { error: "You cannot block or mute yourself" },
      { status: 400 }
    );
  }

  await ensureBlocklistTable();

  const expiresAt =
    data.action === "mute" && data.duration_minutes
      ? new Date(Date.now() + data.duration_minutes * 60 * 1000).toISOString()
      : null;

  await sql`
    INSERT INTO user_blocklist (user_id, target_id, action, duration_minutes, expires_at)
    VALUES (
      ${session.userId},
      ${data.target_id},
      ${data.action},
      ${data.duration_minutes ?? null},
      ${expiresAt}
    )
    ON CONFLICT (user_id, target_id, action)
    DO UPDATE SET
      duration_minutes = EXCLUDED.duration_minutes,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
  `;

  return NextResponse.json(
    {
      message: `User ${data.action === "block" ? "blocked" : "muted"} successfully`,
      target_id: data.target_id,
      action: data.action,
      expires_at: expiresAt,
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/routes-f/blocklist
 * Unblock or unmute a user. Expects ?target_id=xxx&action=block|mute
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("target_id");
  const action = searchParams.get("action");

  if (!targetId) {
    return NextResponse.json(
      { error: "target_id query parameter is required" },
      { status: 400 }
    );
  }

  await ensureBlocklistTable();

  if (action && (action === "block" || action === "mute")) {
    await sql`
      DELETE FROM user_blocklist
      WHERE user_id = ${session.userId}
        AND target_id = ${targetId}
        AND action = ${action}
    `;
  } else {
    await sql`
      DELETE FROM user_blocklist
      WHERE user_id = ${session.userId}
        AND target_id = ${targetId}
    `;
  }

  return NextResponse.json({ message: "Entry removed successfully" });
}
