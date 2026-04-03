import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending"; // pending | reviewed | resolved | all
  const severity = searchParams.get("severity") ?? "all"; // low | medium | high | critical | all
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let result;
    if (status === "all" && severity === "all") {
      result = await sql`
        SELECT id, reporter_id, category, description, severity, status, created_at
        FROM bug_reports
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (status === "all") {
      result = await sql`
        SELECT id, reporter_id, category, description, severity, status, created_at
        FROM bug_reports
        WHERE severity = ${severity}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (severity === "all") {
      result = await sql`
        SELECT id, reporter_id, category, description, severity, status, created_at
        FROM bug_reports
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT id, reporter_id, category, description, severity, status, created_at
        FROM bug_reports
        WHERE status = ${status} AND severity = ${severity}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return Response.json({ reports: result.rows, page, limit });
  } catch (err) {
    console.error("[admin/reports/bug] GET error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
