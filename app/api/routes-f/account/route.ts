import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

// ────────────────────────────────────────────────────────────────
// Table setup
// ────────────────────────────────────────────────────────────────

async function ensureAccountTables(): Promise<void> {
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active'
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS route_f_account_deletion_requests (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      scrub_after  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
      cancelled_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancel_token TEXT NOT NULL DEFAULT gen_random_uuid()::text
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_account_deletion_user
    ON route_f_account_deletion_requests(user_id)
  `;

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
}

// ────────────────────────────────────────────────────────────────
// DELETE /api/routes-f/account
// Request account deletion (soft-delete with 14-day grace period).
// ────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    await ensureAccountTables();

    // Check current account status
    const { rows: userRows } = await sql`
      SELECT status FROM users WHERE id = ${session.userId} LIMIT 1
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userRows[0].status === "pending_deletion") {
      return NextResponse.json(
        { error: "Account deletion already pending" },
        { status: 409 }
      );
    }

    // Cancel any previous uncancelled deletion requests
    await sql`
      UPDATE route_f_account_deletion_requests
      SET cancelled_at = NOW()
      WHERE user_id = ${session.userId}
        AND cancelled_at IS NULL
        AND completed_at IS NULL
    `;

    // Create new deletion request
    const { rows: requestRows } = await sql`
      INSERT INTO route_f_account_deletion_requests (user_id)
      VALUES (${session.userId})
      RETURNING id, cancel_token, scrub_after
    `;

    // Mark user as pending deletion
    await sql`
      UPDATE users
      SET status = 'pending_deletion',
          deletion_scheduled_at = NOW() + INTERVAL '14 days',
          updated_at = NOW()
      WHERE id = ${session.userId}
    `;

    const request = requestRows[0];

    // Note: In production, send cancellation email with the cancel_token link.
    // e.g. sendAccountDeletionEmail({ email: session.email, cancelToken: request.cancel_token })
    console.log(
      `[account] Deletion requested for user ${session.userId}, scrub after ${request.scrub_after}`
    );

    return NextResponse.json({
      message: "Account deletion scheduled",
      deletion_id: request.id,
      scrub_after: request.scrub_after,
      cancellation_window_days: 14,
    });
  } catch (error) {
    console.error("[routes-f/account] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to request account deletion" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────
// GET /api/routes-f/account
// Returns account status information.
// ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    await ensureAccountTables();

    const { rows } = await sql`
      SELECT status, deletion_scheduled_at, deactivated_at, created_at
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = rows[0];

    // Check for pending deletion request
    const { rows: deletionRows } = await sql`
      SELECT id, scrub_after, cancel_token
      FROM route_f_account_deletion_requests
      WHERE user_id = ${session.userId}
        AND cancelled_at IS NULL
        AND completed_at IS NULL
      ORDER BY requested_at DESC
      LIMIT 1
    `;

    return NextResponse.json({
      status: user.status ?? "active",
      deletion_scheduled_at: user.deletion_scheduled_at,
      deactivated_at: user.deactivated_at,
      created_at: user.created_at,
      pending_deletion: deletionRows.length > 0
        ? {
            deletion_id: deletionRows[0].id,
            scrub_after: deletionRows[0].scrub_after,
          }
        : null,
    });
  } catch (error) {
    console.error("[routes-f/account] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account status" },
      { status: 500 }
    );
  }
}
