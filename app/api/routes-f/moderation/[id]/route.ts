import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function requireModOrAdmin(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }

  const { rows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  const role = rows[0]?.role;
  if (role !== "admin" && role !== "moderator") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireModOrAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const { rows } = await sql`
    SELECT *
    FROM moderation_queue
    WHERE id = ${id}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item: rows[0] });
}
