import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const patchMonetizationSchema = z.object({
  tipping_enabled: z.boolean().optional(),
  min_tip_amount: z.number().min(0).optional(),
  subscription_price: z.number().min(0).optional(),
  gift_cooldown_seconds: z.number().int().min(0).max(86400).optional(),
});

async function ensureMonetizationSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_monetization (
      creator_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tipping_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
      min_tip_amount    NUMERIC(10,2) NOT NULL DEFAULT 1.00,
      subscription_price NUMERIC(10,2) NOT NULL DEFAULT 5.00,
      gift_cooldown_seconds INT NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

const DEFAULT_SETTINGS = {
  tipping_enabled: true,
  min_tip_amount: 1.0,
  subscription_price: 5.0,
  gift_cooldown_seconds: 0,
};

/**
 * GET /api/routes-f/monetization
 * Returns current monetization settings for the authenticated creator.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    await ensureMonetizationSchema();

    const { rows } = await sql`
      SELECT tipping_enabled, min_tip_amount, subscription_price, gift_cooldown_seconds, updated_at
      FROM route_f_monetization
      WHERE creator_id = ${session.userId}
      LIMIT 1
    `;

    const settings = rows.length > 0 ? rows[0] : DEFAULT_SETTINGS;
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[routes-f monetization GET]", error);
    return NextResponse.json({ error: "Failed to fetch monetization settings" }, { status: 500 });
  }
}

/**
 * PATCH /api/routes-f/monetization
 * Update monetization settings for the authenticated creator.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, patchMonetizationSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { tipping_enabled, min_tip_amount, subscription_price, gift_cooldown_seconds } = bodyResult.data;

  if (Object.keys(bodyResult.data).length === 0) {
    return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
  }

  try {
    await ensureMonetizationSchema();

    const { rows } = await sql`
      INSERT INTO route_f_monetization (
        creator_id, tipping_enabled, min_tip_amount, subscription_price, gift_cooldown_seconds, updated_at
      )
      VALUES (
        ${session.userId},
        ${tipping_enabled ?? DEFAULT_SETTINGS.tipping_enabled},
        ${min_tip_amount ?? DEFAULT_SETTINGS.min_tip_amount},
        ${subscription_price ?? DEFAULT_SETTINGS.subscription_price},
        ${gift_cooldown_seconds ?? DEFAULT_SETTINGS.gift_cooldown_seconds},
        NOW()
      )
      ON CONFLICT (creator_id) DO UPDATE SET
        tipping_enabled        = COALESCE(${tipping_enabled ?? null}, route_f_monetization.tipping_enabled),
        min_tip_amount         = COALESCE(${min_tip_amount ?? null}, route_f_monetization.min_tip_amount),
        subscription_price     = COALESCE(${subscription_price ?? null}, route_f_monetization.subscription_price),
        gift_cooldown_seconds  = COALESCE(${gift_cooldown_seconds ?? null}, route_f_monetization.gift_cooldown_seconds),
        updated_at             = NOW()
      RETURNING tipping_enabled, min_tip_amount, subscription_price, gift_cooldown_seconds, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[routes-f monetization PATCH]", error);
    return NextResponse.json({ error: "Failed to update monetization settings" }, { status: 500 });
  }
}
