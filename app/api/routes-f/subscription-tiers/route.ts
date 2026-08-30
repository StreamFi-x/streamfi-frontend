/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tierSchema = z.object({
  name: z.string().min(1).max(100),
  price_usdc: z.number().positive(),
  duration_days: z.number().int().positive(),
  perks: z.array(z.string()).default([]),
});

const createTierSchema = tierSchema;
const updateTierSchema = tierSchema.partial().omit({ perks: true }).extend({
  perks: z.array(z.string()).optional(),
});

/**
 * GET /api/routes-f/subscription-tiers?creator_id=...
 * List subscription tiers for a creator
 */
export async function GET(req: NextRequest) {
  const queryResult = validateQuery(
    req.nextUrl.searchParams,
    z.object({ creator_id: z.string() })
  );

  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { creator_id } = queryResult.data;

  try {
    const { rows } = await sql`
      SELECT id, name, price_usdc, duration_days, perks, active, created_at
      FROM subscription_tiers
      WHERE creator_id = ${creator_id} AND active = true
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ tiers: rows });
  } catch (error) {
    console.error("[Subscription Tiers API] Error fetching tiers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routes-f/subscription-tiers
 * Create a new subscription tier for the authenticated creator
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createTierSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { name, price_usdc, duration_days, perks } = bodyResult.data;

  try {
    const { rows: countRows } = await sql`
      SELECT COUNT(*) as count
      FROM subscription_tiers
      WHERE creator_id = ${session.userId} AND active = true
    `;

    if (countRows[0].count >= 5) {
      return NextResponse.json(
        { error: "Cannot exceed 5 active tiers per creator" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      INSERT INTO subscription_tiers (
        creator_id, name, price_usdc, duration_days, perks, active, created_at
      )
      VALUES (
        ${session.userId},
        ${name},
        ${price_usdc},
        ${duration_days},
        ${JSON.stringify(perks)},
        true,
        CURRENT_TIMESTAMP
      )
      RETURNING id, name, price_usdc, duration_days, perks, active, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[Subscription Tiers API] Error creating tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

