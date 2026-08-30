/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * POST /api/routes-f/tip-refund-request
 * 
 * Request a refund for a tip. Only permitted within 60 seconds of the tip.
 * Requires creator agreement to be processed.
 * 
 * Request body:
 * {
 *   tip_id: string (UUID of the tip to refund),
 *   reason?: string (optional reason for refund request),
 * }
 * 
 * Response 201:
 *   {
 *     request_id: string (UUID),
 *     tip_id: string,
 *     status: "pending_creator_approval",
 *     created_at: string (ISO 8601),
 *     expires_at: string (when creator must respond),
 *   }
 * 
 * Error responses:
 *   400 — invalid body, invalid tip_id, tip outside 60 second window
 *   401 — unauthorized (no session)
 *   403 — sender is not the tipper
 *   404 — tip not found
 *   409 — refund already requested for this tip
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFUND_WINDOW_SECONDS = 60;
const CREATOR_RESPONSE_WINDOW_HOURS = 24;

const tipRefundRequestSchema = z.object({
  tip_id: z.string().uuid("tip_id must be a valid UUID"),
  reason: z.string().max(500, "reason must be 500 characters or less").optional(),
});

type TipRefundRequestInput = z.infer<typeof tipRefundRequestSchema>;

interface TipDetails {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount_xlm: string;
  created_at: string;
  status: string;
}

/**
 * Get tip details from database
 */
async function getTipDetails(tip_id: string): Promise<TipDetails | null> {
  try {
    const { rows } = await sql`
      SELECT 
        id,
        sender_id,
        recipient_id,
        amount_xlm,
        created_at,
        status
      FROM tips
      WHERE id = ${tip_id}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0] as any;
    return {
      id: row.id,
      sender_id: row.sender_id,
      recipient_id: row.recipient_id,
      amount_xlm: row.amount_xlm,
      created_at: row.created_at,
      status: row.status,
    };
  } catch (error) {
    console.error("[tip-refund-request] Error fetching tip:", error);
    throw error;
  }
}

/**
 * Check if a refund request already exists for this tip
 */
async function hasExistingRefundRequest(tip_id: string): Promise<boolean> {
  try {
    const { rows } = await sql`
      SELECT id
      FROM refund_requests
      WHERE tip_id = ${tip_id}
        AND status != 'rejected'
        AND status != 'completed'
      LIMIT 1
    `;

    return rows.length > 0;
  } catch (error) {
    console.error("[tip-refund-request] Error checking refund requests:", error);
    throw error;
  }
}

/**
 * Create refund request in database
 */
async function createRefundRequest(
  tip_id: string,
  tipper_id: string,
  reason?: string
): Promise<{ request_id: string; expires_at: string }> {
  try {
    const expiresAt = new Date(Date.now() + CREATOR_RESPONSE_WINDOW_HOURS * 3600000);

    const { rows } = await sql`
      INSERT INTO refund_requests (
        tip_id,
        tipper_id,
        reason,
        status,
        expires_at,
        created_at
      )
      VALUES (
        ${tip_id},
        ${tipper_id},
        ${reason || null},
        'pending_creator_approval',
        ${expiresAt.toISOString()},
        CURRENT_TIMESTAMP
      )
      RETURNING id, expires_at
    `;

    if (rows.length === 0) {
      throw new Error("Failed to create refund request");
    }

    const row = rows[0] as any;
    return {
      request_id: row.id,
      expires_at: row.expires_at,
    };
  } catch (error) {
    console.error("[tip-refund-request] Error creating refund request:", error);
    throw error;
  }
}

/**
 * Emit notification event to creator about refund request
 */
async function notifyCreatorOfRefundRequest(
  recipient_id: string,
  tipper_id: string,
  tip_id: string,
  amount: string
): Promise<void> {
  try {
    // Import here to avoid circular dependency
    const { insertActivityEvent } = await import(
      "@/app/api/routes-f/activity/_lib/insert"
    );

    await insertActivityEvent({
      userId: recipient_id,
      type: "tip_received", // Reusing tip_received event type, metadata indicates refund request
      actorId: tipper_id,
      metadata: {
        tip_id,
        amount_xlm: amount,
        refund_requested: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[tip-refund-request] Error notifying creator:", error);
    // Don't throw - notification is best-effort
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Validate request body
  const bodyResult = await validateBody(req, tipRefundRequestSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { tip_id, reason } = bodyResult.data;

  try {
    // Get tip details
    const tip = await getTipDetails(tip_id);
    if (!tip) {
      return NextResponse.json({ error: "Tip not found" }, { status: 404 });
    }

    // Verify session user is the tipper
    if (tip.sender_id !== session.userId) {
      return NextResponse.json(
        { error: "Only the tipper can request a refund" },
        { status: 403 }
      );
    }

    // Check if tip is within 60 second window
    const tipAge = Date.now() - new Date(tip.created_at).getTime();
    if (tipAge > REFUND_WINDOW_SECONDS * 1000) {
      return NextResponse.json(
        {
          error: `Refund requests must be made within ${REFUND_WINDOW_SECONDS} seconds of the tip`,
        },
        { status: 400 }
      );
    }

    // Check if tip status is confirmed (can only refund confirmed tips)
    if (tip.status !== "confirmed") {
      return NextResponse.json(
        { error: "Only confirmed tips can be refunded" },
        { status: 400 }
      );
    }

    // Check for existing refund request
    const hasExisting = await hasExistingRefundRequest(tip_id);
    if (hasExisting) {
      return NextResponse.json(
        { error: "A refund request already exists for this tip" },
        { status: 409 }
      );
    }

    // Create refund request
    const { request_id, expires_at } = await createRefundRequest(
      tip_id,
      session.userId,
      reason
    );

    // Notify creator (best-effort)
    await notifyCreatorOfRefundRequest(
      tip.recipient_id,
      session.userId,
      tip_id,
      tip.amount_xlm
    );

    return NextResponse.json(
      {
        request_id,
        tip_id,
        status: "pending_creator_approval",
        created_at: new Date().toISOString(),
        expires_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[tip-refund-request] Unexpected error:", error);

    if (error instanceof Error) {
      if (error.message.includes("duplicate")) {
        return NextResponse.json(
          { error: "Refund request already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create refund request" },
      { status: 500 }
    );
  }
}
