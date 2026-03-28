import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

type SocialLink = {
  socialTitle: string;
  socialLink: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normaliseSocialLinks(input: unknown): SocialLink[] {
  if (input === undefined) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new Error("social_links must be an array");
  }

  return input.map(link => {
    if (!isRecord(link)) {
      throw new Error("Each social link must be an object");
    }

    const rawTitle = link.socialTitle ?? link.title;
    const rawUrl = link.socialLink ?? link.url;

    if (typeof rawTitle !== "string" || !rawTitle.trim()) {
      throw new Error("Each social link must include a socialTitle");
    }

    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      throw new Error("Each social link must include a socialLink");
    }

    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("invalid protocol");
      }
    } catch {
      throw new Error("Each social link must have a valid http(s) URL");
    }

    return {
      socialTitle: rawTitle.trim(),
      socialLink: rawUrl.trim(),
    };
  });
}

function normaliseReason(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("reason is required");
  }

  const reason = value.trim();
  if (reason.length < 20) {
    throw new Error("reason must be at least 20 characters");
  }
  if (reason.length > 2000) {
    throw new Error("reason must be 2000 characters or fewer");
  }

  return reason;
}

function normaliseIdDocumentUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("id_document_url must be a string");
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid protocol");
    }
    return value.trim();
  } catch {
    throw new Error("id_document_url must be a valid http(s) URL");
  }
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

async function getCurrentStatus(userId: string) {
  const result = await sql<{
    id: string;
    status: Exclude<VerificationStatus, "unverified">;
    social_links: unknown;
    reason: string;
    id_document_url: string | null;
    rejection_reason: string | null;
    reviewed_at: string | Date | null;
    created_at: string | Date;
    updated_at: string | Date;
  }>`
    SELECT
      id,
      status,
      social_links,
      reason,
      id_document_url,
      rejection_reason,
      reviewed_at,
      created_at,
      updated_at
    FROM creator_verification_requests
    WHERE creator_id = ${userId}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return {
      status: "unverified" as const,
      request: null,
    };
  }

  const row = result.rows[0];
  return {
    status: row.status,
    request: {
      id: row.id,
      status: row.status,
      social_links: Array.isArray(row.social_links) ? row.social_links : [],
      reason: row.reason,
      id_document_url: row.id_document_url,
      rejection_reason: row.rejection_reason,
      reviewed_at:
        row.reviewed_at instanceof Date
          ? row.reviewed_at.toISOString()
          : row.reviewed_at,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : row.updated_at,
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureVerificationTable();
    const status = await getCurrentStatus(session.userId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[routes-f/verification] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureVerificationTable();

    const payload = await req.json();
    const socialLinks = normaliseSocialLinks(payload?.social_links);
    const reason = normaliseReason(payload?.reason);
    const idDocumentUrl = normaliseIdDocumentUrl(payload?.id_document_url);

    const existing = await sql<{ status: VerificationStatus }>`
      SELECT status
      FROM creator_verification_requests
      WHERE creator_id = ${session.userId}
      LIMIT 1
    `;

    const currentStatus = existing.rows[0]?.status;
    if (currentStatus === "pending") {
      return NextResponse.json(
        { error: "Verification request is already pending" },
        { status: 409 }
      );
    }

    if (currentStatus === "verified") {
      return NextResponse.json(
        { error: "Creator is already verified" },
        { status: 409 }
      );
    }

    await sql`
      INSERT INTO creator_verification_requests (
        creator_id,
        status,
        social_links,
        reason,
        id_document_url,
        rejection_reason,
        reviewed_by,
        reviewed_at,
        updated_at
      )
      VALUES (
        ${session.userId},
        'pending',
        ${JSON.stringify(socialLinks)}::jsonb,
        ${reason},
        ${idDocumentUrl},
        NULL,
        NULL,
        NULL,
        NOW()
      )
      ON CONFLICT (creator_id) DO UPDATE SET
        status = 'pending',
        social_links = EXCLUDED.social_links,
        reason = EXCLUDED.reason,
        id_document_url = EXCLUDED.id_document_url,
        rejection_reason = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = NOW()
    `;

    const status = await getCurrentStatus(session.userId);
    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[routes-f/verification] POST error:", error);
    return NextResponse.json(
      { error: "Failed to submit verification request" },
      { status: 500 }
    );
  }
}
