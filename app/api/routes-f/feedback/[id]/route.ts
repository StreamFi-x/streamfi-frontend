import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["new", "read", "actioned", "dismissed"]),
});

async function requireAdmin(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }
  const { rows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  if (rows[0]?.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

/** Admin only — update feedback status. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const result = await validateBody(req, updateStatusSchema);
  if (result instanceof NextResponse) {
    return result;
  }
  const { status } = result.data;

  const { id } = await params;

  const { rows } = await sql`
    UPDATE feedback
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, type, subject, status, created_at
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  return NextResponse.json({ feedback: rows[0] });
}
