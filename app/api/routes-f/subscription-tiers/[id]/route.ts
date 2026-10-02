import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateTierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price_usdc: z.number().positive().optional(),
  duration_days: z.number().int().positive().optional(),
  perks: z.array(z.string()).optional(),
});

/**
 * PATCH /api/routes-f/subscription-tiers/[id]
 * Update a subscription tier
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, updateTierSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { id } = await params;
  const { name, price_usdc, duration_days, perks } = bodyResult.data;

  try {
    const { rows: tierRows } = await sql`
      SELECT creator_id FROM subscription_tiers WHERE id = ${id}
    `;

    if (tierRows.length === 0) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    if (tierRows[0].creator_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      name === undefined &&
      price_usdc === undefined &&
      duration_days === undefined &&
      perks === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { rows: currentRows } = await sql`
      SELECT name, price_usdc, duration_days, perks FROM subscription_tiers WHERE id = ${id}
    `;
    const current = currentRows[0];

    const { rows } = await sql`
      UPDATE subscription_tiers
      SET
        name = ${name ?? current.name},
        price_usdc = ${price_usdc ?? current.price_usdc},
        duration_days = ${duration_days ?? current.duration_days},
        perks = ${JSON.stringify(perks ?? current.perks)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, name, price_usdc, duration_days, perks, active, created_at
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[Subscription Tiers API] Error updating tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routes-f/subscription-tiers/[id]
 * Soft-delete a subscription tier
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    const { rows: tierRows } = await sql`
      SELECT creator_id FROM subscription_tiers WHERE id = ${id}
    `;

    if (tierRows.length === 0) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    if (tierRows[0].creator_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`
      UPDATE subscription_tiers
      SET active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ message: "Tier deleted" });
  } catch (error) {
    console.error("[Subscription Tiers API] Error deleting tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
