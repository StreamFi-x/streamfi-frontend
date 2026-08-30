/**
 * POST /api/routes-f/tip-confirm
 * 
 * Verify a signed XLM transaction hash on Stellar Horizon, persist the tip row,
 * and emit a chat event for notification.
 * 
 * Request body:
 * {
 *   tx_hash: string (Stellar transaction hash),
 *   amount: string (XLM amount, e.g., "10.0000000"),
 *   recipient_channel_id: string (recipient's channel ID),
 * }
 * 
 * Response 201:
 *   {
 *     tip_id: string,
 *     tx_hash: string,
 *     amount: string,
 *     status: "confirmed",
 *     ledger: number,
 *     created_at: string (ISO 8601),
 *   }
 * 
 * Error responses:
 *   400 — invalid body, invalid tx_hash format
 *   401 — unauthorized (no session)
 *   404 — transaction not found on Horizon
 *   409 — transaction already confirmed/duplicate tip
 *   500 — database error or Horizon verification failed
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { getStellarNetwork, getHorizonUrl } from "@/lib/stellar/config";
import { sql } from "@vercel/postgres";
import * as StellarSdk from "@stellar/stellar-sdk";
import { insertActivityEvent } from "@/app/api/routes-f/activity/_lib/insert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tipConfirmSchema = z.object({
  tx_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "tx_hash must be a valid 64-character hex string"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, "amount must be a valid XLM amount with up to 7 decimals"),
  recipient_channel_id: z.string().min(1, "recipient_channel_id is required"),
});

type TipConfirmRequest = z.infer<typeof tipConfirmSchema>;

interface TransactionDetails {
  hash: string;
  ledger: number;
  source: string;
  destination: string;
  amount: string;
  timestamp: string;
}

/**
 * Verify transaction on Horizon and extract details
 */
async function verifyTransactionOnHorizon(
  tx_hash: string,
  network: "testnet" | "mainnet"
): Promise<TransactionDetails | null> {
  try {
    const horizonUrl = getHorizonUrl(network);
    const server = new StellarSdk.Horizon.Server(horizonUrl);

    const response = await server.transactions().transaction(tx_hash).call();

    if (!response || !response.successful) {
      return null;
    }

    // Find the payment operation from the transaction's operations
    const operations = await response.operations();
    const paymentOp = operations.records.find(
      (op: any) => op.type === "payment" || op.type === "path_payment_strict_receive"
    );

    if (!paymentOp) {
      return null;
    }

    return {
      hash: response.hash,
      ledger: response.ledger_attr,
      source: response.source_account,
      destination: (paymentOp as any).to || (paymentOp as any).destination,
      amount: (paymentOp as any).amount,
      timestamp: response.created_at,
    };
  } catch (error) {
    console.error("[tip-confirm] Horizon verification error:", error);
    return null;
  }
}

/**
 * Get recipient's user ID from channel ID
 */
async function getRecipientUserIdFromChannel(
  channel_id: string
): Promise<string | null> {
  try {
    const { rows } = await sql`
      SELECT user_id 
      FROM channels 
      WHERE channel_id = ${channel_id} 
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    return (rows[0] as any).user_id;
  } catch (error) {
    console.error("[tip-confirm] Error fetching recipient:", error);
    throw error;
  }
}

/**
 * Check if this tip has already been confirmed
 */
async function isDuplicateTip(
  sender_id: string,
  recipient_id: string,
  tx_hash: string
): Promise<boolean> {
  try {
    const { rows } = await sql`
      SELECT id 
      FROM tips 
      WHERE sender_id = ${sender_id} 
        AND recipient_id = ${recipient_id}
        AND tx_hash = ${tx_hash}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    return rows.length > 0;
  } catch (error) {
    console.error("[tip-confirm] Error checking duplicate:", error);
    throw error;
  }
}

/**
 * Persist tip to database
 */
async function persistTip(
  sender_id: string,
  recipient_id: string,
  tx_hash: string,
  amount: string,
  ledger: number
): Promise<{ id: string; created_at: string }> {
  try {
    const { rows } = await sql`
      INSERT INTO tips (
        sender_id,
        recipient_id,
        tx_hash,
        amount_xlm,
        ledger,
        status,
        created_at
      )
      VALUES (
        ${sender_id},
        ${recipient_id},
        ${tx_hash},
        ${amount},
        ${ledger},
        'confirmed',
        CURRENT_TIMESTAMP
      )
      RETURNING id, created_at
    `;

    if (rows.length === 0) {
      throw new Error("Failed to insert tip");
    }

    const row = rows[0] as any;
    return {
      id: row.id,
      created_at: row.created_at,
    };
  } catch (error) {
    console.error("[tip-confirm] Error persisting tip:", error);
    throw error;
  }
}

/**
 * Emit chat event for the tip notification
 */
async function emitTipChatEvent(
  recipient_id: string,
  sender_id: string,
  amount: string,
  tip_id: string
): Promise<void> {
  try {
    await insertActivityEvent({
      userId: recipient_id,
      type: "tip_received",
      actorId: sender_id,
      metadata: {
        tip_id,
        amount_xlm: amount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[tip-confirm] Error emitting chat event:", error);
    // Don't throw - tip is already persisted, event emission is best-effort
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Validate request body
  const bodyResult = await validateBody(req, tipConfirmSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { tx_hash, amount, recipient_channel_id } = bodyResult.data;

  try {
    // Get network
    const network = getStellarNetwork();

    // Verify transaction on Horizon
    const txDetails = await verifyTransactionOnHorizon(tx_hash, network);
    if (!txDetails) {
      return NextResponse.json(
        { error: "Transaction not found or failed on Horizon" },
        { status: 404 }
      );
    }

    // Verify amount matches
    if (txDetails.amount !== amount) {
      return NextResponse.json(
        { error: "Transaction amount does not match request amount" },
        { status: 400 }
      );
    }

    // Get recipient's user ID
    const recipient_id = await getRecipientUserIdFromChannel(recipient_channel_id);
    if (!recipient_id) {
      return NextResponse.json(
        { error: "Recipient channel not found" },
        { status: 404 }
      );
    }

    // Check for duplicate tips
    const isDuplicate = await isDuplicateTip(session.userId, recipient_id, tx_hash);
    if (isDuplicate) {
      return NextResponse.json(
        { error: "This tip has already been confirmed" },
        { status: 409 }
      );
    }

    // Persist tip to database
    const { id: tip_id, created_at } = await persistTip(
      session.userId,
      recipient_id,
      tx_hash,
      amount,
      txDetails.ledger
    );

    // Emit chat event (best-effort)
    await emitTipChatEvent(recipient_id, session.userId, amount, tip_id);

    return NextResponse.json(
      {
        tip_id,
        tx_hash,
        amount,
        status: "confirmed",
        ledger: txDetails.ledger,
        created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[tip-confirm] Unexpected error:", error);

    if (error instanceof Error) {
      if (error.message.includes("duplicate")) {
        return NextResponse.json(
          { error: "Duplicate tip detected" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to confirm tip" },
      { status: 500 }
    );
  }
}
