import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { rows: adminRows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  const role = adminRows[0]?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
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
