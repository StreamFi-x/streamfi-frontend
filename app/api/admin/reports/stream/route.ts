import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<Response> {
  const adminDenied = await requireAdminSession("admin/reports/stream");
  if (adminDenied) {
    return adminDenied;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending"; // pending | reviewed | dismissed | all
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let result;
    // Expedited reports (#1447: a volume spike or coordinated-account
    // signal) sort first within a status, so a brigade attempt surfaces to
    // the top of the review queue rather than waiting behind ordinary
    // reports in strict chronological order.
    if (status === "all") {
      result = await sql`
        SELECT id, reporter_id, is_anonymous, priority, stream_id, streamer, reason, details, status, created_at
        FROM stream_reports
        ORDER BY (priority = 'expedited') DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT id, reporter_id, is_anonymous, priority, stream_id, streamer, reason, details, status, created_at
        FROM stream_reports
        WHERE status = ${status}
        ORDER BY (priority = 'expedited') DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return Response.json({ reports: result.rows, page, limit });
  } catch (err) {
    console.error("[admin/reports/stream] GET error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
