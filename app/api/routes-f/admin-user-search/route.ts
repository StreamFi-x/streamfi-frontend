import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { rows: userRows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  const role = userRows[0]?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Missing required query parameter: q" }, { status: 400 });
  }

  const term = `%${q}%`;
  try {
    const { rows } = await sql`
      SELECT id, username, email, wallet_address, role, is_suspended, created_at
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
