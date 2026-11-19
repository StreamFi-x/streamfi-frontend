import { authorizeAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(req: NextRequest): Promise<Response> {
  const { response: adminDenied } = await authorizeAdmin(
    req,
    "routes-f/admin-feature-flag-list"
  );
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
