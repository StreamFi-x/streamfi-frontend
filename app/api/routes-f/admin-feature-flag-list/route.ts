import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { requireAdminPrincipal } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const adminDenied = await requireAdminPrincipal(req, {
    mechanism: "session_role",
    route: "routes-f/admin-feature-flag-list",
    userId: session.userId,
    check: async () => {
      const { rows: adminRows } = await sql`
        SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
      `;
      return adminRows[0]?.role === "admin";
    },
  });
  if (adminDenied) {
    return adminDenied;
  }

  try {
    const { rows } = await sql`
      SELECT flag_key, name, description, enabled, rollout_percentage, updated_at
      FROM feature_flags
      ORDER BY flag_key ASC
    `;

    return NextResponse.json({ feature_flags: rows });
  } catch (err) {
    console.error("[admin-feature-flag-list] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
