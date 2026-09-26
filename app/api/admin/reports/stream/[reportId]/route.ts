import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdminSession } from "@/lib/admin-auth";

/**
 * The audit trail behind a report's priority (#1447): a reviewer seeing
 * "expedited" needs to know why, not just trust the label — a human always
 * makes the actual moderation call, this is what they're calling it with.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
): Promise<Response> {
  const adminDenied = await requireAdminSession(
    "admin/reports/stream/[reportId]"
  );
  if (adminDenied) {
    return adminDenied;
  }

  const { reportId } = await params;

  try {
    const { rows: reportRows } = await sql`
      SELECT id, reporter_id, is_anonymous, priority, stream_id, streamer, reason, details, status, created_at
      FROM stream_reports
      WHERE id = ${reportId}
    `;
    if (reportRows.length === 0) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const { rows: flagRows } = await sql`
      SELECT signal, detail, created_at
      FROM stream_report_flags
      WHERE report_id = ${reportId}
      ORDER BY created_at ASC
    `;

    return Response.json({ report: reportRows[0], flags: flagRows });
  } catch (err) {
    console.error("[admin/reports/stream/[reportId]] GET error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
): Promise<Response> {
  const adminDenied = await requireAdminSession(
    "admin/reports/stream/[reportId]"
  );
  if (adminDenied) {
    return adminDenied;
  }

  const { reportId } = await params;
  const body = await req.json();
  const status: string = body.status;

  const validStatuses = ["reviewed", "dismissed"];
  if (!validStatuses.includes(status)) {
    return Response.json(
      { error: "status must be 'reviewed' or 'dismissed'" },
      { status: 400 }
    );
  }

  try {
    await sql`
      UPDATE stream_reports
      SET status = ${status}
      WHERE id = ${reportId}
    `;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/reports/stream/[reportId]] PATCH error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
