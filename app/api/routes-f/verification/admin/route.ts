import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

function getAdminEmails(): string[] {
  return (
    process.env.ROUTES_F_ADMIN_EMAILS ??
    process.env.ADMIN_EMAILS ??
    process.env.STREAMFI_ADMIN_EMAILS ??
    ""
  )
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

async function ensureVerificationTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_verification_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
      reason TEXT NOT NULL,
      id_document_url TEXT,
      rejection_reason TEXT,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT creator_verification_requests_status_check
        CHECK (status IN ('pending', 'verified', 'rejected'))
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_creator_verification_requests_status
    ON creator_verification_requests (status, created_at)
  `;
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const adminEmails = getAdminEmails();
  if (!session.email || !adminEmails.includes(session.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await ensureVerificationTable();

    const result = await sql<{
      id: string;
      status: string;
      social_links: unknown;
      reason: string;
      id_document_url: string | null;
      created_at: string | Date;
      updated_at: string | Date;
      creator_id: string;
      username: string;
      avatar: string | null;
      email: string | null;
    }>`
      SELECT
        r.id,
        r.status,
        r.social_links,
        r.reason,
        r.id_document_url,
        r.created_at,
        r.updated_at,
        u.id AS creator_id,
        u.username,
        u.avatar,
        u.email
      FROM creator_verification_requests r
      JOIN users u ON u.id = r.creator_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC
    `;

    return NextResponse.json({
      requests: result.rows.map(row => ({
        id: row.id,
        status: row.status,
        social_links: Array.isArray(row.social_links) ? row.social_links : [],
        reason: row.reason,
        id_document_url: row.id_document_url,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        updated_at:
          row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : row.updated_at,
        creator: {
          id: row.creator_id,
          username: row.username,
          avatar: row.avatar,
          email: row.email,
        },
      })),
    });
  } catch (error) {
    console.error("[routes-f/verification/admin] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification requests" },
      { status: 500 }
    );
  }
}
