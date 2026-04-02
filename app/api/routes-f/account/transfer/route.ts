import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";

// ────────────────────────────────────────────────────────────────
// Schema
// ────────────────────────────────────────────────────────────────

const initiateTransferSchema = z.object({
  to_username: usernameSchema,
  verification_code: z
    .string()
    .length(6, "Verification code must be 6 characters")
    .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

// ────────────────────────────────────────────────────────────────
// Table setup
// ────────────────────────────────────────────────────────────────

async function ensureTransferTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_channel_transfers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status          VARCHAR(30) NOT NULL DEFAULT 'pending',
      verification_code VARCHAR(6),
      code_expires_at TIMESTAMPTZ,
      acceptance_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_channel_transfers_from
    ON route_f_channel_transfers(from_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_channel_transfers_to
    ON route_f_channel_transfers(to_user_id)
  `;
}

// ────────────────────────────────────────────────────────────────
// POST /api/routes-f/account/transfer
// Initiate a channel transfer to another user.
// Requires 2FA verification (email code).
// ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  const bodyResult = await validateBody(req, initiateTransferSchema);
  if (bodyResult instanceof NextResponse) {return bodyResult;}

  const { to_username, verification_code } = bodyResult.data;

  try {
    await ensureTransferTable();

    // ────────────────────────────────────────────────────────────
    // 1. Verify 2FA code from verification_tokens table
    // ────────────────────────────────────────────────────────────
    if (!session.email) {
      return NextResponse.json(
        { error: "Email required for 2FA verification" },
        { status: 400 }
      );
    }

    const { rows: tokenRows } = await sql`
      SELECT token FROM verification_tokens
      WHERE email = ${session.email}
        AND token = ${verification_code}
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (tokenRows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 403 }
      );
    }

    // Consume the token
    await sql`
      DELETE FROM verification_tokens
      WHERE email = ${session.email}
        AND token = ${verification_code}
    `;

    // ────────────────────────────────────────────────────────────
    // 2. Validate target user
    // ────────────────────────────────────────────────────────────
    if (
      session.username &&
      to_username.toLowerCase() === session.username.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Cannot transfer channel to yourself" },
        { status: 400 }
      );
    }

    const { rows: targetRows } = await sql`
      SELECT id, username, email
      FROM users
      WHERE LOWER(username) = LOWER(${to_username})
      LIMIT 1
    `;

    if (targetRows.length === 0) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const targetUser = targetRows[0];

    // ────────────────────────────────────────────────────────────
    // 3. Check no pending transfer exists
    // ────────────────────────────────────────────────────────────
    const { rows: pendingRows } = await sql`
      SELECT id FROM route_f_channel_transfers
      WHERE from_user_id = ${session.userId}
        AND status = 'pending'
        AND token_expires_at > NOW()
      LIMIT 1
    `;

    if (pendingRows.length > 0) {
      return NextResponse.json(
        { error: "A channel transfer is already pending" },
        { status: 409 }
      );
    }

    // ────────────────────────────────────────────────────────────
    // 4. Create transfer request
    // ────────────────────────────────────────────────────────────
    const { rows: transferRows } = await sql`
      INSERT INTO route_f_channel_transfers (from_user_id, to_user_id)
      VALUES (${session.userId}, ${targetUser.id})
      RETURNING id, acceptance_token, token_expires_at
    `;

    const transfer = transferRows[0];

    // Note: In production, send acceptance email to target user.
    // e.g. sendChannelTransferEmail({
    //   email: targetUser.email,
    //   fromUsername: session.username,
    //   acceptanceToken: transfer.acceptance_token,
    //   expiresAt: transfer.token_expires_at
    // })
    console.log(
      `[account/transfer] Transfer initiated from ${session.userId} to ${targetUser.id}, expires ${transfer.token_expires_at}`
    );

    return NextResponse.json({
      message: "Channel transfer initiated",
      transfer_id: transfer.id,
      to_username: targetUser.username,
      token_expires_at: transfer.token_expires_at,
    });
  } catch (error) {
    console.error("[routes-f/account/transfer] POST error:", error);
    return NextResponse.json(
      { error: "Failed to initiate channel transfer" },
      { status: 500 }
    );
  }
}
