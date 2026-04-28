import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function verifyAdminSession(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }

  const { rows } = await sql`
    SELECT 1
    FROM users
    WHERE id = ${session.userId}
      AND (
        is_admin = TRUE
        OR role = 'admin'
      )
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    namespaces: [
      { namespace: "streams", hit_ratio: null, entries: null },
      { namespace: "users", hit_ratio: null, entries: null },
      { namespace: "search", hit_ratio: null, entries: null },
    ],
    note: "Runtime cache stats are not directly available in Next.js route handlers",
  });
}
