import { authorizeAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(req: NextRequest): Promise<Response> {
  const { response: adminDenied } = await authorizeAdmin(
    req,
    "routes-f/admin-user-search"
  );
  if (adminDenied) {
    return adminDenied;
  }

  const searchParams = new URL(req.url).searchParams;
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 }
    );
  }

  const term = `%${q}%`;
  try {
    const { rows } = await sql`
      -- tombstone-aware: admin view includes accounts pending deletion
      SELECT id, username, email, wallet_address, role, is_suspended, created_at, deleted_at
      FROM users
      WHERE username ILIKE ${term}
         OR email ILIKE ${term}
         OR wallet_address ILIKE ${term}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({ query: q, users: rows });
  } catch (err) {
    console.error("[admin-user-search] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
