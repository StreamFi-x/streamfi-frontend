/**
 * POST /api/routes-f/tip-dispute-file
 *
 * File a new dispute against a tip transaction.
 * Requires authenticated user (viewer or creator).
 *
 * Request body:
 * {
 *   tx_hash: string (Stellar transaction hash of the disputed tip),
 *   reason: string (predefined reason: unauthorized_transaction, account_compromise, coercion, minor_access, fraudulent_payment_method, service_not_rendered, other),
 *   description: string (detailed explanation of the dispute),
 *   plaintiff_type: "viewer" | "creator" (who is filing the dispute)
 * }
 *
 * Response 201:
 *   {
 *     dispute_id: string (UUID),
 *     tx_hash: string,
 *     status: "open",
 *     created_at: string (ISO 8601),
 *     message: string
 *   }
 *
 * Error responses:
 *   400 — invalid body, rate limited, abuse pattern detected
 *   401 — unauthorized (no session)
 *   404 — transaction not found
 *   409 — dispute already exists for this transaction
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import { markRecentWrite } from "@/lib/db/replica";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REASONS = [
  "unauthorized_transaction",
  "account_compromise",
  "coercion",
  "minor_access",
  "fraudulent_payment_method",
  "service_not_rendered",
  "other",
] as const;

const fileDisputeSchema = z.object({
  tx_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "tx_hash must be a valid 64-character hex string"),
  reason: z.enum(VALID_REASONS),
  description: z
    .string()
    .min(10, "description must be at least 10 characters")
    .max(2000, "description must be at most 2000 characters"),
  plaintiff_type: z.enum(["viewer", "creator"]),
});

type FileDisputeRequest = z.infer<typeof fileDisputeSchema>;

/**
 * Get tip details from transaction hash
 */
async function getTipByTxHash(tx_hash: string): Promise<any> {
  try {
    const { rows } = await sql`
      SELECT id, sender_id, recipient_id, amount_xlm, amount_usdc, asset, status, created_at
      FROM tips
      WHERE tx_hash = ${tx_hash}
      LIMIT 1
    `;
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error("[tip-dispute-file] Error fetching tip:", error);
    throw error;
  }
}

/**
 * Check if user can file a dispute (rate limiting)
 */
async function isRateLimited(user_id: string): Promise<boolean> {
  try {
    const { rows } = await sql`
      SELECT is_dispute_rate_limited(${user_id}::UUID) as is_limited
    `;
    return rows[0]?.is_limited || false;
  } catch (error) {
    logger.warn("[tip-dispute-file] Error checking rate limit:", error);
    // Fail open - don't block user if check fails
    return false;
  }
}

/**
 * Check for abuse pattern (multiple disputes against same creator)
 */
async function hasAbusePattern(
  plaintiff_id: string,
  recipient_id: string
): Promise<boolean> {
  try {
    const { rows } = await sql`
      SELECT has_abuse_pattern_against_creator(${plaintiff_id}::UUID, ${recipient_id}::UUID) as has_pattern
    `;
    return rows[0]?.has_pattern || false;
  } catch (error) {
    logger.warn("[tip-dispute-file] Error checking abuse pattern:", error);
    return false;
  }
}

/**
 * Check if dispute already exists for this transaction
 */
async function disputeAlreadyExists(tx_hash: string): Promise<boolean> {
  try {
    const { rows } = await sql`
      SELECT id FROM tip_disputes
      WHERE tx_hash = ${tx_hash}
        AND (status != 'dismissed' OR status != 'resolved')
        AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (error) {
    logger.warn("[tip-dispute-file] Error checking for duplicate dispute:", error);
    return false;
  }
}

/**
 * Create dispute record
 */
async function createDispute(
  tip_id: string,
  tx_hash: string,
  plaintiff_id: string,
  plaintiff_type: string,
  sender_id: string,
  recipient_id: string,
  amount: string,
  asset: string,
  reason: string,
  description: string
): Promise<{ id: string; created_at: string }> {
  try {
    const { rows } = await sql`
      INSERT INTO tip_disputes (
        tip_id,
        tx_hash,
        plaintiff_id,
        plaintiff_type,
        sender_id,
        recipient_id,
        amount_disputed,
        asset_disputed,
        reason,
        description,
        status,
        created_at
      )
      VALUES (
        ${tip_id}::UUID,
        ${tx_hash},
        ${plaintiff_id}::UUID,
        ${plaintiff_type},
        ${sender_id}::UUID,
        ${recipient_id}::UUID,
        ${amount},
        ${asset},
        ${reason},
        ${description},
        'open',
        NOW()
      )
      RETURNING id, created_at
    `;

    if (rows.length === 0) {
      throw new Error("Failed to create dispute");
    }

    return {
      id: rows[0].id,
      created_at: rows[0].created_at,
    };
  } catch (error) {
    logger.error("[tip-dispute-file] Error creating dispute:", error);
    throw error;
  }
}

/**
 * Update dispute metrics for the user
 */
async function updateDisputeMetrics(user_id: string): Promise<void> {
  try {
    await sql`
      INSERT INTO dispute_metrics (
        user_id,
        disputes_filed_lifetime,
        disputes_filed_30d,
        last_dispute_filed,
        updated_at
      )
      VALUES (
        ${user_id}::UUID,
        1,
        1,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        disputes_filed_lifetime = dispute_metrics.disputes_filed_lifetime + 1,
        disputes_filed_30d = dispute_metrics.disputes_filed_30d + 1,
        last_dispute_filed = NOW(),
        updated_at = NOW()
    `;
  } catch (error) {
    logger.warn("[tip-dispute-file] Error updating metrics:", error);
    // Non-critical
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Validate request body
  const bodyResult = await validateBody(req, fileDisputeSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { tx_hash, reason, description, plaintiff_type } = bodyResult.data;

  try {
    // Check rate limiting
    const isLimited = await isRateLimited(session.userId);
    if (isLimited) {
      logger.warn("[tip-dispute-file] User rate limited", {
        user_id: session.userId,
      });
      return NextResponse.json(
        {
          error: "Too many disputes filed. Please try again later.",
          retryAfter: 3600,
        },
        { status: 400, headers: { "Retry-After": "3600" } }
      );
    }

    // Fetch the original tip
    const tip = await getTipByTxHash(tx_hash);
    if (!tip) {
      return NextResponse.json(
        { error: "Tip transaction not found" },
        { status: 404 }
      );
    }

    // Validate that the user filing the dispute is actually a party to the transaction
    if (
      plaintiff_type === "viewer" &&
      tip.sender_id !== session.userId
    ) {
      return NextResponse.json(
        { error: "Only the sender can file a dispute as viewer" },
        { status: 400 }
      );
    }

    if (
      plaintiff_type === "creator" &&
      tip.recipient_id !== session.userId
    ) {
      return NextResponse.json(
        { error: "Only the recipient can file a dispute as creator" },
        { status: 400 }
      );
    }

    // Check if dispute already exists for this transaction
    const exists = await disputeAlreadyExists(tx_hash);
    if (exists) {
      return NextResponse.json(
        { error: "A dispute already exists for this transaction" },
        { status: 409 }
      );
    }

    // Check for abuse pattern (multiple disputes against same creator)
    const hasPattern = await hasAbusePattern(session.userId, tip.recipient_id);
    if (hasPattern) {
      logger.warn("[tip-dispute-file] Abuse pattern detected", {
        plaintiff_id: session.userId,
        recipient_id: tip.recipient_id,
      });
      return NextResponse.json(
        {
          error: "Multiple disputes against this creator detected. Your dispute has been flagged for review.",
          flaggedForReview: true,
        },
        { status: 400 }
      );
    }

    // Create the dispute
    const { id: dispute_id, created_at } = await createDispute(
      tip.id,
      tx_hash,
      session.userId,
      plaintiff_type,
      tip.sender_id,
      tip.recipient_id,
      tip.amount_xlm || tip.amount_usdc || "0",
      tip.asset || "XLM",
      reason,
      description
    );

    // Update metrics
    await updateDisputeMetrics(session.userId);

    logger.info("[tip-dispute-file] Dispute filed successfully", {
      dispute_id,
      tx_hash: tx_hash.substring(0, 16),
      plaintiff_id: session.userId,
      plaintiff_type,
      reason,
    });

    return markRecentWrite(
      NextResponse.json(
        {
          dispute_id,
          tx_hash,
          status: "open",
          created_at,
          message: "Dispute filed successfully. Our team will review it within 48 hours.",
        },
        { status: 201 }
      )
    );
  } catch (error) {
    logger.error("[tip-dispute-file] Unexpected error:", error);

    if (error instanceof Error && error.message.includes("rate")) {
      return NextResponse.json(
        {
          error: "You have reached the maximum number of disputes. Please try again later.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to file dispute. Please try again." },
      { status: 500 }
    );
  }
}
