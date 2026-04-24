import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  const { reportId } = await params;
  const body = await req.json();
  const status: string = body.status;

  const validStatuses = ["reviewed", "resolved"];
  if (!validStatuses.includes(status)) {
    return Response.json(
      { error: "status must be 'reviewed' or 'resolved'" },
      { status: 400 }
    );
  }

  try {
    await sql`
      UPDATE bug_reports
      SET status = ${status}
      WHERE id = ${reportId}
    `;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/reports/bug/[reportId]] PATCH error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
