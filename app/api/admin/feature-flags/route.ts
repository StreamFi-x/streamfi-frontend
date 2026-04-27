import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { isAdmin } from "@/lib/admin-auth";

/**
 * Admin-only CRUD for feature flags.
 *
 * GET    /api/admin/feature-flags          – list all flags
 * POST   /api/admin/feature-flags          – create a flag
 * PATCH  /api/admin/feature-flags          – update a flag (body: { key, ...fields })
 * DELETE /api/admin/feature-flags?key=xxx  – delete a flag
 */

async function guardAdmin(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return { ok: false as const, response: session.response };
  if (!isAdmin(session.userId)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) return guard.response;

  const { rows } = await sql`SELECT * FROM feature_flags ORDER BY key`;
  return NextResponse.json({ flags: rows });
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) return guard.response;

  const { key, description, enabled = false, rollout_percentage = 0, allowed_user_ids = [] } = await req.json();
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const { rows } = await sql`
    INSERT INTO feature_flags (key, description, enabled, rollout_percentage, allowed_user_ids)
    VALUES (${key}, ${description ?? null}, ${enabled}, ${rollout_percentage}, ${allowed_user_ids})
    ON CONFLICT (key) DO NOTHING
    RETURNING *
  `;
  if (!rows.length) return NextResponse.json({ error: "Flag already exists" }, { status: 409 });
  return NextResponse.json({ flag: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) return guard.response;

  const { key, enabled, rollout_percentage, allowed_user_ids, description } = await req.json();
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const { rows } = await sql`
    UPDATE feature_flags SET
      enabled             = COALESCE(${enabled ?? null}, enabled),
      rollout_percentage  = COALESCE(${rollout_percentage ?? null}, rollout_percentage),
      allowed_user_ids    = COALESCE(${allowed_user_ids ?? null}, allowed_user_ids),
      description         = COALESCE(${description ?? null}, description),
      updated_at          = CURRENT_TIMESTAMP
    WHERE key = ${key}
    RETURNING *
  `;
  if (!rows.length) return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  return NextResponse.json({ flag: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) return guard.response;

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  await sql`DELETE FROM feature_flags WHERE key = ${key}`;
  return NextResponse.json({ ok: true });
}
