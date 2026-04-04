import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { stellarPublicKeySchema } from "@/app/api/routes-f/_lib/schemas";

// ────────────────────────────────────────────────────────────────
// Schema
// ────────────────────────────────────────────────────────────────

const payoutFrequency = z.enum(["weekly", "biweekly", "monthly"]);

const updatePayoutScheduleSchema = z.object({
  frequency: payoutFrequency.optional(),
  minimum_threshold_usdc: z
    .number()
    .min(5, "Minimum threshold must be at least 5.00 USDC")
    .optional(),
  wallet_address: stellarPublicKeySchema.optional(),
});

// ────────────────────────────────────────────────────────────────
// Table setup
// ────────────────────────────────────────────────────────────────

async function ensurePayoutScheduleTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_payout_schedules (
      user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      frequency              VARCHAR(20) NOT NULL DEFAULT 'monthly',
      minimum_threshold_usdc NUMERIC(10,2) NOT NULL DEFAULT 5.00,
      wallet_address         VARCHAR(56),
      next_payout_date       TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + INTERVAL '1 month'),
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Compute the next payout date from now based on frequency.
 */
function computeNextPayoutDate(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case "weekly": {
      const next = new Date(now);
      next.setDate(now.getDate() + ((7 - now.getDay()) % 7) || 7);
      next.setHours(0, 0, 0, 0);
      return next.toISOString();
    }
    case "biweekly": {
      const next = new Date(now);
      next.setDate(now.getDate() + 14 - ((now.getDay() || 7) - 1));
      if (next <= now) {
        next.setDate(next.getDate() + 14);
      }
      next.setHours(0, 0, 0, 0);
      return next.toISOString();
    }
    case "monthly":
    default: {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return next.toISOString();
    }
  }
}

// ────────────────────────────────────────────────────────────────
// GET /api/routes-f/creator/payout-schedule
// Returns current payout schedule settings for the authenticated creator.
// ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensurePayoutScheduleTable();

    const { rows } = await sql`
      SELECT frequency, minimum_threshold_usdc, wallet_address,
             next_payout_date, created_at, updated_at
      FROM route_f_payout_schedules
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({
        frequency: "monthly",
        minimum_threshold_usdc: "5.00",
        wallet_address: null,
        next_payout_date: computeNextPayoutDate("monthly"),
      });
    }

    const row = rows[0];
    return NextResponse.json({
      frequency: row.frequency,
      minimum_threshold_usdc: Number(row.minimum_threshold_usdc).toFixed(2),
      wallet_address: row.wallet_address,
      next_payout_date: row.next_payout_date,
    });
  } catch (error) {
    console.error("[routes-f/creator/payout-schedule] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payout schedule" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────
// PATCH /api/routes-f/creator/payout-schedule
// Update payout schedule preferences.
// ────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, updatePayoutScheduleSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { frequency, minimum_threshold_usdc, wallet_address } = bodyResult.data;

  // Require at least one field to update
  if (
    frequency === undefined &&
    minimum_threshold_usdc === undefined &&
    wallet_address === undefined
  ) {
    return NextResponse.json(
      { error: "At least one field must be provided" },
      { status: 400 }
    );
  }

  try {
    await ensurePayoutScheduleTable();

    // Fetch current values to merge updates
    const { rows: currentRows } = await sql`
      SELECT frequency, minimum_threshold_usdc, wallet_address
      FROM route_f_payout_schedules
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    const current = currentRows[0] ?? {
      frequency: "monthly",
      minimum_threshold_usdc: 5.0,
      wallet_address: null,
    };

    const newFrequency = frequency ?? current.frequency;
    const newThreshold =
      minimum_threshold_usdc ?? Number(current.minimum_threshold_usdc);
    const newWallet = wallet_address ?? current.wallet_address;
    const nextPayout = computeNextPayoutDate(newFrequency);

    const { rows } = await sql`
      INSERT INTO route_f_payout_schedules (
        user_id, frequency, minimum_threshold_usdc, wallet_address, next_payout_date
      )
      VALUES (
        ${session.userId},
        ${newFrequency},
        ${newThreshold},
        ${newWallet},
        ${nextPayout}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        frequency              = EXCLUDED.frequency,
        minimum_threshold_usdc = EXCLUDED.minimum_threshold_usdc,
        wallet_address         = EXCLUDED.wallet_address,
        next_payout_date       = EXCLUDED.next_payout_date,
        updated_at             = NOW()
      RETURNING frequency, minimum_threshold_usdc, wallet_address, next_payout_date
    `;

    const row = rows[0];
    return NextResponse.json({
      frequency: row.frequency,
      minimum_threshold_usdc: Number(row.minimum_threshold_usdc).toFixed(2),
      wallet_address: row.wallet_address,
      next_payout_date: row.next_payout_date,
    });
  } catch (error) {
    console.error("[routes-f/creator/payout-schedule] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update payout schedule" },
      { status: 500 }
    );
  }
}
