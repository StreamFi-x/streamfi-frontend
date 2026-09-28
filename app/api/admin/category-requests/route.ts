/**
 * GET /api/admin/category-requests — admin review queue (#1429)
 *
 * Lists pending requests along with the existing categories whose normalized
 * name or title is closest to the proposed one (pg_trgm similarity, already
 * enabled by add-routes-f-platform-features.sql), so an admin can spot a
 * near-duplicate before approving a fragmenting new category.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminDenied = await requireAdminSession("admin/category-requests");
  if (adminDenied) {
    return adminDenied;
  }

  const status = req.nextUrl.searchParams.get("status") ?? "pending";

  const { rows: requests } = await sql`
    SELECT cr.id, cr.proposed_title, cr.normalized_key, cr.rationale, cr.status,
           cr.created_at, u.username AS requested_by_username
    FROM category_requests cr
    LEFT JOIN users u ON u.id = cr.requested_by AND u.deleted_at IS NULL
    WHERE cr.status = ${status}
    ORDER BY cr.created_at ASC
  `;

  const withSuggestions = await Promise.all(
    requests.map(async request => {
      const { rows: similar } = await sql`
        SELECT id, title, similarity(title, ${request.proposed_title}) AS score
        FROM stream_categories
        WHERE similarity(title, ${request.proposed_title}) > 0.3
        ORDER BY score DESC
        LIMIT 5
      `;
      return { ...request, similarCategories: similar };
    })
  );

  return NextResponse.json({ requests: withSuggestions });
}
