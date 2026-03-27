import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureVerificationRequestsTable, requireAdminSession } from "../_shared";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const forbiddenResponse = requireAdminSession(session);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    await ensureVerificationRequestsTable();

    const { rows } = await sql`
      SELECT
        cvr.id,
        cvr.user_id,
        cvr.status,
        cvr.social_links,
        cvr.reason,
        cvr.id_document_url,
        cvr.rejection_reason,
        cvr.reviewed_by,
        cvr.reviewed_at,
        cvr.created_at,
        cvr.updated_at,
        u.username,
        u.email,
        u.wallet,
        u.avatar
      FROM creator_verification_requests cvr
      JOIN users u ON u.id = cvr.user_id
      WHERE cvr.status = 'pending'
      ORDER BY cvr.created_at ASC
    `;

    const requests = rows.map(row => ({
      id: String(row.id),
      user_id: String(row.user_id),
      username: typeof row.username === "string" ? row.username : null,
      email: typeof row.email === "string" ? row.email : null,
      wallet: typeof row.wallet === "string" ? row.wallet : null,
      avatar: typeof row.avatar === "string" ? row.avatar : null,
      status: "pending" as const,
      social_links: Array.isArray(row.social_links) ? row.social_links : [],
      reason: typeof row.reason === "string" ? row.reason : "",
      id_document_url:
        typeof row.id_document_url === "string" ? row.id_document_url : null,
      rejection_reason:
        typeof row.rejection_reason === "string" ? row.rejection_reason : null,
      reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
      reviewed_at:
        row.reviewed_at instanceof Date
          ? row.reviewed_at.toISOString()
          : typeof row.reviewed_at === "string"
            ? row.reviewed_at
            : null,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET verification admin list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification requests" },
      { status: 500 }
    );
  }
}
