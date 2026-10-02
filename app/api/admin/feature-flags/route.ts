import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { requireAdminPrincipal } from "@/lib/admin-auth";
import { currentAdminPrivyId } from "@/lib/admin-auth";
import { withAdminAudit } from "@/lib/audit/admin-events";

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
  if (!session.ok) {return { ok: false as const, response: session.response };}
  const denied = await requireAdminPrincipal(req, {
    mechanism: "session_role",
    route: "admin/feature-flags",
    userId: session.userId,
    check: () => true,
  });
  if (denied) {
    return { ok: false as const, response: denied };
  }
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) {return guard.response;}

  const { rows } = await sql`SELECT * FROM feature_flags ORDER BY key`;
  return NextResponse.json({ flags: rows });
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) {return guard.response;}

  const { key, description, enabled = false, rollout_percentage = 0, allowed_user_ids = [] } = await req.json();
  if (!key) {return NextResponse.json({ error: "key is required" }, { status: 400 });}

  try {
    const flag = await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: "feature_flag_created", targetType: "feature_flag", targetId: key },
      async tx => {
        const { rows } = await tx.sql`
          INSERT INTO feature_flags (key, description, enabled, rollout_percentage, allowed_user_ids)
          VALUES (${key}, ${description ?? null}, ${enabled}, ${rollout_percentage}, ${allowed_user_ids})
          ON CONFLICT (key) DO NOTHING RETURNING *
        `;
        if (!rows.length) {throw new Error("FEATURE_FLAG_EXISTS");}
        return { result: rows[0], beforeState: null, afterState: { enabled: rows[0].enabled, rollout_percentage: rows[0].rollout_percentage, description: rows[0].description } };
      }
    );
    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FEATURE_FLAG_EXISTS") {
      return NextResponse.json({ error: "Flag already exists" }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) {return guard.response;}

  const { key, enabled, rollout_percentage, allowed_user_ids, description } = await req.json();
  if (!key) {return NextResponse.json({ error: "key is required" }, { status: 400 });}

  try {
    const flag = await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: "feature_flag_updated", targetType: "feature_flag", targetId: key },
      async tx => {
        const { rows: beforeRows } = await tx.sql`SELECT enabled, rollout_percentage, allowed_user_ids, description FROM feature_flags WHERE key = ${key} FOR UPDATE`;
        if (!beforeRows.length) {throw new Error("FEATURE_FLAG_NOT_FOUND");}
        const { rows } = await tx.sql`
          UPDATE feature_flags SET
            enabled = COALESCE(${enabled ?? null}, enabled),
            rollout_percentage = COALESCE(${rollout_percentage ?? null}, rollout_percentage),
            allowed_user_ids = COALESCE(${allowed_user_ids ?? null}, allowed_user_ids),
            description = COALESCE(${description ?? null}, description),
            updated_at = CURRENT_TIMESTAMP
          WHERE key = ${key} RETURNING *
        `;
        return { result: rows[0], beforeState: beforeRows[0], afterState: { enabled: rows[0].enabled, rollout_percentage: rows[0].rollout_percentage, allowed_user_ids: rows[0].allowed_user_ids, description: rows[0].description } };
      }
    );
    return NextResponse.json({ flag });
  } catch (error) {
    if (error instanceof Error && error.message === "FEATURE_FLAG_NOT_FOUND") {
      return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (!guard.ok) {return guard.response;}

  const key = new URL(req.url).searchParams.get("key");
  if (!key) {return NextResponse.json({ error: "key is required" }, { status: 400 });}

  try {
    await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: "feature_flag_deleted", targetType: "feature_flag", targetId: key },
      async tx => {
        const { rows } = await tx.sql`DELETE FROM feature_flags WHERE key = ${key} RETURNING enabled, rollout_percentage, allowed_user_ids, description`;
        return { result: undefined, beforeState: rows[0] ?? null, afterState: null };
      }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/feature-flags] DELETE error", error);
    return NextResponse.json({ error: "Unable to delete flag" }, { status: 500 });
  }
}
