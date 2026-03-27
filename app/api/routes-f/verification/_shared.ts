import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { VerifiedSession } from "@/lib/auth/verify-session";

export const VERIFICATION_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface VerificationSocialLink {
  socialTitle: string;
  socialLink: string;
}

export interface VerificationRequestRecord {
  id: string;
  user_id: string;
  status: Exclude<VerificationStatus, "unverified">;
  social_links: VerificationSocialLink[];
  reason: string;
  id_document_url: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAllowedSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map(entry => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function ensureVerificationRequestsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_verification_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'verified', 'rejected')),
      social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
      reason TEXT NOT NULL,
      id_document_url TEXT,
      rejection_reason TEXT,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_creator_verification_requests_status
    ON creator_verification_requests(status, created_at)
  `;
}

export function normalizeSocialLinks(
  value: unknown
): VerificationSocialLink[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const normalized: VerificationSocialLink[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const title =
      typeof item.socialTitle === "string"
        ? item.socialTitle
        : typeof item.title === "string"
          ? item.title
          : typeof item.platform === "string"
            ? item.platform
            : null;

    const link =
      typeof item.socialLink === "string"
        ? item.socialLink
        : typeof item.url === "string"
          ? item.url
          : null;

    if (!title || !link) {
      return null;
    }

    try {
      const parsedUrl = new URL(link);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return null;
      }
    } catch {
      return null;
    }

    normalized.push({
      socialTitle: title.trim(),
      socialLink: link.trim(),
    });
  }

  return normalized.every(
    link => link.socialTitle.length > 0 && link.socialLink.length > 0
  )
    ? normalized
    : null;
}

export function normalizeOptionalUrl(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const parsedUrl = new URL(value);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return undefined;
    }
    return value.trim();
  } catch {
    return undefined;
  }
}

export function parseExistingRequest(
  row: Record<string, unknown> | undefined
): VerificationRequestRecord | null {
  if (!row) {
    return null;
  }

  const status =
    typeof row.status === "string" &&
    ["pending", "verified", "rejected"].includes(row.status)
      ? (row.status as VerificationRequestRecord["status"])
      : "pending";

  const socialLinks =
    Array.isArray(row.social_links) && row.social_links.length > 0
      ? normalizeSocialLinks(row.social_links) ?? []
      : [];

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    status,
    social_links: socialLinks,
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
  };
}

export function verificationStatusResponse(
  record: VerificationRequestRecord | null
) {
  if (!record) {
    return {
      status: "unverified" as const,
      request: null,
    };
  }

  return {
    status: record.status,
    request: {
      social_links: record.social_links,
      reason: record.reason,
      id_document_url: record.id_document_url,
      rejection_reason: record.rejection_reason,
      reviewed_at: record.reviewed_at,
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
  };
}

export function requireAdminSession(
  session: Extract<VerifiedSession, { ok: true }>
): NextResponse | null {
  const allowedUserIds = parseAllowedSet(process.env.VERIFICATION_ADMIN_USER_IDS);
  const allowedEmails = parseAllowedSet(process.env.VERIFICATION_ADMIN_EMAILS);

  const isAllowed =
    allowedUserIds.has(session.userId.toLowerCase()) ||
    (!!session.email && allowedEmails.has(session.email.toLowerCase()));

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
