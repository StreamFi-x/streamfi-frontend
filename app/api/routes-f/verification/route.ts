import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  ensureVerificationRequestsTable,
  normalizeOptionalUrl,
  normalizeSocialLinks,
  parseExistingRequest,
  verificationStatusResponse,
} from "./_shared";

async function getCurrentRequest(userId: string) {
  const { rows } = await sql`
    SELECT
      id,
      user_id,
      status,
      social_links,
      reason,
      id_document_url,
      rejection_reason,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at
    FROM creator_verification_requests
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  return parseExistingRequest(rows[0]);
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureVerificationRequestsTable();
    const record = await getCurrentRequest(session.userId);
    return NextResponse.json(verificationStatusResponse(record));
  } catch (error) {
    console.error("GET verification status error:", error);
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const socialLinks = normalizeSocialLinks(payload.social_links);
  if (!socialLinks) {
    return NextResponse.json(
      {
        error:
          "social_links must be a non-empty array of link objects with title/url values",
      },
      { status: 400 }
    );
  }

  const reason =
    typeof payload.reason === "string" ? payload.reason.trim() : undefined;
  if (!reason) {
    return NextResponse.json(
      { error: "reason is required" },
      { status: 400 }
    );
  }

  const idDocumentUrl = normalizeOptionalUrl(payload.id_document_url);
  if (payload.id_document_url !== undefined && idDocumentUrl === undefined) {
    return NextResponse.json(
      { error: "id_document_url must be a valid http(s) URL" },
      { status: 400 }
    );
  }

  try {
    await ensureVerificationRequestsTable();
    const existing = await getCurrentRequest(session.userId);

    if (existing?.status === "pending") {
      return NextResponse.json(
        { error: "Cannot resubmit while verification is pending" },
        { status: 409 }
      );
    }

    if (existing?.status === "verified") {
      return NextResponse.json(
        { error: "Creator is already verified" },
        { status: 409 }
      );
    }

    if (existing) {
      await sql`
        UPDATE creator_verification_requests
        SET
          status = 'pending',
          social_links = ${JSON.stringify(socialLinks)}::jsonb,
          reason = ${reason},
          id_document_url = ${idDocumentUrl ?? null},
          rejection_reason = NULL,
          reviewed_by = NULL,
          reviewed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${session.userId}
      `;
    } else {
      await sql`
        INSERT INTO creator_verification_requests (
          user_id,
          status,
          social_links,
          reason,
          id_document_url
        )
        VALUES (
          ${session.userId},
          'pending',
          ${JSON.stringify(socialLinks)}::jsonb,
          ${reason},
          ${idDocumentUrl ?? null}
        )
      `;
    }

    const record = await getCurrentRequest(session.userId);
    return NextResponse.json(verificationStatusResponse(record), { status: 201 });
  } catch (error) {
    console.error("POST verification request error:", error);
    return NextResponse.json(
      { error: "Failed to submit verification request" },
      { status: 500 }
    );
  }
}
