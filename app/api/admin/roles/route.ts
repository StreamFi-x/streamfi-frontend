import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { currentAdminPrivyId, requireAdminIdentity } from "@/lib/admin-auth";
import { withAdminAudit } from "@/lib/audit/admin-events";

const ASSIGNABLE_ROLES = ["user", "support", "moderator", "super_admin"] as const;

export async function PATCH(request: NextRequest): Promise<Response> {
  const { response } = await requireAdminIdentity("admin/roles");
  if (response) {return response;}

  let body: { userId?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.userId !== "string" || !ASSIGNABLE_ROLES.includes(body.role as typeof ASSIGNABLE_ROLES[number])) {
    return NextResponse.json({ error: "Valid userId and role are required" }, { status: 400 });
  }

  try {
    const actorId = await currentAdminPrivyId();
    const role = body.role as typeof ASSIGNABLE_ROLES[number];
    const result = await withAdminAudit(
      { actorId, action: "admin_role_changed", targetType: "user", targetId: body.userId },
      async tx => {
        const { rows: beforeRows } = await tx.sql`
          SELECT id, role FROM users WHERE id = ${body.userId} AND deleted_at IS NULL FOR UPDATE
        `;
        if (!beforeRows.length) {throw new Error("ADMIN_ROLE_USER_NOT_FOUND");}
        if (beforeRows[0].id === body.userId && role === "super_admin" && beforeRows[0].role === "super_admin") {
          return { result: { role: beforeRows[0].role }, beforeState: { role: beforeRows[0].role }, afterState: { role: beforeRows[0].role } };
        }
        const { rows } = await tx.sql`
          UPDATE users SET role = ${role}, updated_at = now()
          WHERE id = ${body.userId} AND deleted_at IS NULL RETURNING id, role
        `;
        return {
          result: { role: rows[0].role },
          beforeState: { role: beforeRows[0].role },
          afterState: { role: rows[0].role },
        };
      }
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_ROLE_USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("[admin/roles] assignment failed", error);
    return NextResponse.json({ error: "Unable to assign role" }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  const { response } = await requireAdminIdentity("admin/roles");
  if (response) {return response;}
  const { rows } = await sql`
    SELECT id, username, privy_id, role FROM users
    WHERE role IN ('support', 'moderator', 'super_admin') AND deleted_at IS NULL
    ORDER BY role, username LIMIT 500
  `;
  return NextResponse.json({ users: rows });
}