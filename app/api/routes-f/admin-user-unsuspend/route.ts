import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function POST(req: NextRequest): Promise<Response> {
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

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      UPDATE users
      SET is_suspended = false, suspended_at = NULL, suspension_reason = NULL
      WHERE id = ${body.userId}
      RETURNING id, username, email, is_suspended
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "User account unsuspended successfully",
      user: rows[0],
    });
  } catch (err) {
    console.error("[admin-user-unsuspend] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
