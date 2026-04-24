import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";

export async function GET(): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  try {
    const { rows } = await sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_banned = false)            AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_live = true)               AS live_now,
        (SELECT COUNT(*) FROM stream_reports WHERE status = 'pending')  AS pending_stream_reports,
        (SELECT COUNT(*) FROM bug_reports    WHERE status = 'pending')  AS pending_bug_reports,
        (SELECT COUNT(*) FROM users
          WHERE created_at > now() - INTERVAL '7 days')                AS new_users_7d,
        (SELECT COUNT(*) FROM stream_categories)                        AS total_categories
    `;

    const row = rows[0];
    return Response.json({
      totalUsers: Number(row.total_users),
      liveNow: Number(row.live_now),
      pendingStreamReports: Number(row.pending_stream_reports),
      pendingBugReports: Number(row.pending_bug_reports),
      newUsers7d: Number(row.new_users_7d),
      totalCategories: Number(row.total_categories),
    });
  } catch (err) {
    console.error("[admin/analytics] DB error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
