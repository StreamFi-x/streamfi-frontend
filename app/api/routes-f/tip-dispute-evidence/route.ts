/**
 * POST /api/routes-f/tip-dispute-evidence
 *
 * Add evidence to a dispute ticket.
 * Requires authentication by plaintiff or admin.
 *
 * Request body (multipart/form-data):
 * {
 *   dispute_id: string (UUID),
 *   evidence_type: string (screenshot | email_correspondence | transaction_history | account_statement | identity_verification | chat_log | other_documentation),
 *   description: string (optional, details about this evidence),
 *   file: File (uploaded document/image)
 * }
 *
 * Response 201:
 *   {
 *     evidence_id: string,
 *     dispute_id: string,
 *     evidence_type: string,
 *     file_url: string,
 *     created_at: string,
 *     message: string
 *   }
 *
 * Error responses:
 *   400 — invalid body, file too large, invalid format
 *   401 — unauthorized (not plaintiff or admin)
 *   404 — dispute not found
 *   413 — file too large (>10MB)
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import { markRecentWrite } from "@/lib/db/replica";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_EVIDENCE_TYPES = [
  "screenshot",
  "email_correspondence",
  "transaction_history",
  "account_statement",
  "identity_verification",
  "chat_log",
  "other_documentation",
] as const;

/**
 * Check if user is an admin
 */
async function isUserAdmin(user_id: string): Promise<boolean> {
  try {
    const { rows } = await sql`
      SELECT 1 FROM admin_users
      WHERE user_id = ${user_id}::UUID
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (error) {
    logger.warn("[tip-dispute-evidence] Error checking admin status:", error);
    return false;
  }
}

/**
 * Get dispute details
 */
async function getDispute(dispute_id: string): Promise<any> {
  try {
    const { rows } = await sql`
      SELECT id, plaintiff_id, status
      FROM tip_disputes
      WHERE id = ${dispute_id}::UUID
        AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error("[tip-dispute-evidence] Error fetching dispute:", error);
    throw error;
  }
}

/**
 * Calculate SHA-256 hash of file buffer
 */
function hashFile(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Store file and return URL (implementation-dependent)
 * For now, just generates a reference
 * In production: upload to S3, GCS, or similar
 */
async function storeFile(
  file_hash: string,
  evidence_type: string,
  file_size: number
): Promise<string> {
  // In production, upload to cloud storage and return signed URL
  // For MVP: return a reference URL
  const timestamp = Date.now();
  return `/api/evidence/${file_hash}/${timestamp}`;
}

/**
 * Record evidence in database
 */
async function recordEvidence(
  dispute_id: string,
  submitted_by: string,
  evidence_type: string,
  description: string | undefined,
  file_url: string,
  file_hash: string,
  file_size: number
): Promise<{ id: string; created_at: string }> {
  try {
    const { rows } = await sql`
      INSERT INTO dispute_evidence (
        dispute_id,
        submitted_by,
        evidence_type,
        description,
        file_url,
        file_hash,
        file_size_bytes,
        created_at
      )
      VALUES (
        ${dispute_id}::UUID,
        ${submitted_by}::UUID,
        ${evidence_type},
        ${description || null},
        ${file_url},
        ${file_hash},
        ${file_size},
        NOW()
      )
      RETURNING id, created_at
    `;

    if (rows.length === 0) {
      throw new Error("Failed to record evidence");
    }

    return {
      id: rows[0].id,
      created_at: rows[0].created_at,
    };
  } catch (error) {
    logger.error("[tip-dispute-evidence] Error recording evidence:", error);
    throw error;
  }
}

/**
 * Update dispute status to evidence_requested if needed
 */
async function updateDisputeStatusIfNeeded(dispute_id: string): Promise<void> {
  try {
    await sql`
      UPDATE tip_disputes
      SET status = 'under_review'
      WHERE id = ${dispute_id}::UUID
        AND status = 'open'
    `;
  } catch (error) {
    logger.warn("[tip-dispute-evidence] Error updating dispute status:", error);
    // Non-critical
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    // Parse multipart form data
    const formData = await req.formData();
    const dispute_id = formData.get("dispute_id") as string;
    const evidence_type = formData.get("evidence_type") as string;
    const description = formData.get("description") as string | null;
    const file = formData.get("file") as File | null;

    // Validate inputs
    if (!dispute_id || !evidence_type || !file) {
      return NextResponse.json(
        { error: "Missing required fields: dispute_id, evidence_type, file" },
        { status: 400 }
      );
    }

    // Validate UUID format
    try {
      new (require("uuid")).validate(dispute_id);
    } catch {
      return NextResponse.json(
        { error: "dispute_id must be a valid UUID" },
        { status: 400 }
      );
    }

    // Validate evidence type
    if (!VALID_EVIDENCE_TYPES.includes(evidence_type as any)) {
      return NextResponse.json(
        {
          error: `evidence_type must be one of: ${VALID_EVIDENCE_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 413 }
      );
    }

    // Get dispute details
    const dispute = await getDispute(dispute_id);
    if (!dispute) {
      return NextResponse.json(
        { error: "Dispute not found" },
        { status: 404 }
      );
    }

    // Check authorization: only plaintiff or admin can add evidence
    const isAdmin = await isUserAdmin(session.userId);
    if (dispute.plaintiff_id !== session.userId && !isAdmin) {
      logger.warn("[tip-dispute-evidence] Unauthorized evidence submission", {
        user_id: session.userId,
        dispute_id,
      });
      return NextResponse.json(
        { error: "You are not authorized to add evidence to this dispute" },
        { status: 401 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const file_hash = hashFile(buffer);

    // Store file (implementation-dependent)
    const file_url = await storeFile(file_hash, evidence_type, buffer.length);

    // Record evidence in database
    const { id: evidence_id, created_at } = await recordEvidence(
      dispute_id,
      session.userId,
      evidence_type,
      description || undefined,
      file_url,
      file_hash,
      buffer.length
    );

    // Update dispute status to under_review if it was open
    await updateDisputeStatusIfNeeded(dispute_id);

    logger.info("[tip-dispute-evidence] Evidence recorded", {
      evidence_id,
      dispute_id,
      evidence_type,
      file_size: buffer.length,
      file_hash: file_hash.substring(0, 16),
    });

    return markRecentWrite(
      NextResponse.json(
        {
          evidence_id,
          dispute_id,
          evidence_type,
          file_url,
          created_at,
          message: "Evidence uploaded successfully.",
        },
        { status: 201 }
      )
    );
  } catch (error) {
    logger.error("[tip-dispute-evidence] Unexpected error:", error);

    if (error instanceof Error && error.message.includes("form")) {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to upload evidence" },
      { status: 500 }
    );
  }
}
