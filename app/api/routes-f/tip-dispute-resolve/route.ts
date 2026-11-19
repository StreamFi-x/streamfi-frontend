/**
 * POST /api/routes-f/tip-dispute-resolve
 *
 * Admin endpoint to resolve a dispute.
 * Requires admin authentication.
 *
 * Request body:
 * {
 *   dispute_id: string (UUID),
 *   resolution_type: "compensating_payment" | "creator_refund" | "both_parties_agree" | "platform_absorbs",
 *   compensating_amount?: string (amount to compensate, required if resolution_type = compensating_payment),
 *   compensating_tx_hash?: string (if payment already made),
 *   resolution_notes: string (explanation of decision),
 *   dismiss?: boolean (set to true to dismiss instead of resolve)
 * }
 *
 * Response 200:
 *   {
 *     dispute_id: string,
 *     status: "resolved" | "dismissed",
 *     resolution_type?: string,
 *     resolved_at: string,
 *     message: string
 *   }
 *
 * Error responses:
 *   400 — invalid body, validation error
 *   401 — unauthorized (not admin)
 *   404 — dispute not found
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

const VALID_RESOLUTION_TYPES = [
  "compensating_payment",
  "creator_refund",
  "both_parties_agree",
  "platform_absorbs",
] as const;

const resolveDisputeSchema = z
  .object({
    dispute_id: z.string().uuid("dispute_id must be a valid UUID"),
    resolution_type: z.enum(VALID_RESOLUTION_TYPES),
    compensating_amount: z.string().optional(),
    compensating_tx_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "compensating_tx_hash must be a valid 64-character hex")
      .optional(),
    resolution_notes: z
      .string()
      .min(10, "resolution_notes must be at least 10 characters")
      .max(3000, "resolution_notes must be at most 3000 characters"),
    dismiss: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (
        data.resolution_type === "compensating_payment" &&
        !data.dismiss &&
        !data.compensating_amount
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "compensating_amount is required when resolution_type is compensating_payment",
      path: ["compensating_amount"],
    }
  );

type ResolveDisputeRequest = z.infer<typeof resolveDisputeSchema>;

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
    logger.warn("[tip-dispute-resolve] Error checking admin status:", error);
    return false;
  }
}

/**
 * Get dispute details
 */
async function getDispute(dispute_id: string): Promise<any> {
  try {
    const { rows } = await sql`
      SELECT *
      FROM tip_disputes
      WHERE id = ${dispute_id}::UUID
        AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error("[tip-dispute-resolve] Error fetching dispute:", error);
    throw error;
  }
}

/**
 * Resolve a dispute
 */
async function resolveDispute(
  dispute_id: string,
  admin_id: string,
  resolution_type: string,
  compensating_amount: string | undefined,
  compensating_tx_hash: string | undefined,
  resolution_notes: string,
  dismiss: boolean
): Promise<{ status: string; resolved_at: string }> {
  try {
    const newStatus = dismiss ? "dismissed" : "resolved";
    const resolvedAt = new Date().toISOString();

    const { rows } = await sql`
      UPDATE tip_disputes
      SET
        status = ${newStatus},
        resolution_type = ${dismiss ? null : resolution_type},
        resolved_by = ${admin_id}::UUID,
        resolved_at = ${resolvedAt},
        resolution_notes = ${resolution_notes},
        compensating_amount = ${compensating_amount ? parseFloat(compensating_amount) : null},
        compensating_tx_hash = ${compensating_tx_hash || null},
        compensating_issued_at = ${compensating_tx_hash ? new Date().toISOString() : null},
        updated_at = NOW()
      WHERE id = ${dispute_id}::UUID
      RETURNING status, resolved_at
    `;

    if (rows.length === 0) {
      throw new Error("Failed to update dispute");
    }

    return {
      status: rows[0].status,
      resolved_at: rows[0].resolved_at,
    };
  } catch (error) {
    logger.error("[tip-dispute-resolve] Error resolving dispute:", error);
    throw error;
  }
}

/**
 * Update dispute metrics based on resolution outcome
 */
async function updateMetricsForResolution(
  dispute_id: string,
  plaintiff_id: string,
  won: boolean
): Promise<void> {
  try {
    if (won) {
      await sql`
        UPDATE dispute_metrics
        SET
          disputes_won_lifetime = disputes_won_lifetime + 1,
          disputes_won_30d = disputes_won_30d + 1,
          updated_at = NOW()
        WHERE user_id = ${plaintiff_id}::UUID
      `;
    } else {
      await sql`
        UPDATE dispute_metrics
        SET
          disputes_lost_lifetime = disputes_lost_lifetime + 1,
          disputes_lost_30d = disputes_lost_30d + 1,
          updated_at = NOW()
        WHERE user_id = ${plaintiff_id}::UUID
      `;
    }
  } catch (error) {
    logger.warn("[tip-dispute-resolve] Error updating metrics:", error);
    // Non-critical
  }
}

/**
 * Flag user for potential abuse if they're losing too many disputes
 */
async function checkAbuseThreshold(user_id: string): Promise<void> {
  try {
    const { rows } = await sql`
      SELECT disputes_won_lifetime, disputes_lost_lifetime
      FROM dispute_metrics
      WHERE user_id = ${user_id}::UUID
    `;

    if (rows.length > 0) {
      const { disputes_won_lifetime, disputes_lost_lifetime } = rows[0];
      const totalDisputes = disputes_won_lifetime + disputes_lost_lifetime;

      // Flag if user loses >80% of disputes AND has >5 disputes
      if (totalDisputes > 5 && disputes_lost_lifetime / totalDisputes > 0.8) {
        await sql`
          UPDATE dispute_metrics
          SET
            is_flagged_for_abuse = TRUE,
            abuse_reason = 'High dispute loss rate (>80%)',
            flagged_at = NOW(),
            updated_at = NOW()
          WHERE user_id = ${user_id}::UUID
        `;

        logger.info("[tip-dispute-resolve] User flagged for abuse", {
          user_id,
          disputes_won: disputes_won_lifetime,
          disputes_lost: disputes_lost_lifetime,
        });
      }
    }
  } catch (error) {
    logger.warn("[tip-dispute-resolve] Error checking abuse threshold:", error);
    // Non-critical
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Check admin authorization
  const isAdmin = await isUserAdmin(session.userId);
  if (!isAdmin) {
    logger.warn("[tip-dispute-resolve] Unauthorized admin access attempt", {
      user_id: session.userId,
    });
    return NextResponse.json(
      { error: "Only admins can resolve disputes" },
      { status: 401 }
    );
  }

  // Validate request body
  const bodyResult = await validateBody(req, resolveDisputeSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const {
    dispute_id,
    resolution_type,
    compensating_amount,
    compensating_tx_hash,
    resolution_notes,
    dismiss,
  } = bodyResult.data;

  try {
    // Fetch the dispute
    const dispute = await getDispute(dispute_id);
    if (!dispute) {
      return NextResponse.json(
        { error: "Dispute not found" },
        { status: 404 }
      );
    }

    // Verify dispute is in a state that can be resolved
    if (!["open", "under_review", "evidence_requested"].includes(dispute.status)) {
      return NextResponse.json(
        {
          error: `Dispute cannot be resolved from status '${dispute.status}'`,
        },
        { status: 400 }
      );
    }

    // Resolve the dispute
    const { status, resolved_at } = await resolveDispute(
      dispute_id,
      session.userId,
      resolution_type,
      compensating_amount,
      compensating_tx_hash,
      resolution_notes,
      dismiss
    );

    // Update metrics based on resolution type
    // For simplicity: compensating_payment, both_parties_agree = plaintiff won; others = lost
    const plaintiffWon =
      !dismiss &&
      (resolution_type === "compensating_payment" ||
        resolution_type === "both_parties_agree");
    await updateMetricsForResolution(dispute_id, dispute.plaintiff_id, plaintiffWon);

    // Check if plaintiff should be flagged for abuse
    if (!plaintiffWon) {
      await checkAbuseThreshold(dispute.plaintiff_id);
    }

    logger.info("[tip-dispute-resolve] Dispute resolved", {
      dispute_id,
      status,
      resolution_type: dismiss ? "dismissed" : resolution_type,
      admin_id: session.userId,
      plaintiff_won: plaintiffWon,
    });

    return markRecentWrite(
      NextResponse.json(
        {
          dispute_id,
          status,
          resolution_type: dismiss ? null : resolution_type,
          resolved_at,
          message: dismiss
            ? "Dispute dismissed."
            : `Dispute resolved with ${resolution_type}.`,
        },
        { status: 200 }
      )
    );
  } catch (error) {
    logger.error("[tip-dispute-resolve] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to resolve dispute" },
      { status: 500 }
    );
  }
}
