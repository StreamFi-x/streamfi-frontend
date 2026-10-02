import { NextRequest } from "next/server";
import { currentAdminPrivyId, requireAdminSession } from "@/lib/admin-auth";
import { withAdminAudit } from "@/lib/audit/admin-events";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
): Promise<Response> {
  const adminDenied = await requireAdminSession("admin/reports/bug/[reportId]");
  if (adminDenied) {
    return adminDenied;
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
    await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: "bug_report_status_changed", targetType: "bug_report", targetId: reportId },
      async tx => {
        const { rows: beforeRows } = await tx.sql`SELECT status FROM bug_reports WHERE id = ${reportId} FOR UPDATE`;
        const { rows } = await tx.sql`UPDATE bug_reports SET status = ${status} WHERE id = ${reportId} RETURNING status`;
        return { result: undefined, beforeState: beforeRows[0] ?? null, afterState: rows[0] ?? null };
      }
    );
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/reports/bug/[reportId]] PATCH error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
