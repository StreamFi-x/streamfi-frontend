import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const LOYALTY_PERKS = [
  "custom_badge",
  "priority_chat",
  "emote_slots",
  "ad_free",
] as const;

type LoyaltyPerk = (typeof LOYALTY_PERKS)[number];

type LoyaltyTier = {
  name: string;
  min_points: number;
  perks: LoyaltyPerk[];
};

const DEFAULT_TIERS: LoyaltyTier[] = [
  { name: "Viewer", min_points: 0, perks: [] },
  { name: "Regular", min_points: 500, perks: ["custom_badge"] },
  {
    name: "VIP",
    min_points: 2000,
    perks: ["custom_badge", "priority_chat"],
  },
  {
    name: "Legend",
    min_points: 10000,
    perks: ["custom_badge", "priority_chat", "emote_slots"],
  },
];

const tierSchema = z.object({
  name: z.string().trim().min(1).max(60),
  min_points: z.number().int().min(0),
  perks: z.array(z.enum(LOYALTY_PERKS)).max(4),
});

const getTierQuerySchema = z.object({
  creator: usernameSchema,
});

const updateTierSchema = z
  .object({
    tiers: z.array(tierSchema).min(1).max(4),
  })
  .superRefine(({ tiers }, ctx) => {
    for (let index = 1; index < tiers.length; index += 1) {
      if (tiers[index].min_points <= tiers[index - 1].min_points) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", index, "min_points"],
          message: "min_points must be strictly ascending",
        });
      }
    }
  });

async function ensureLoyaltyTierSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_loyalty_tiers (
      creator_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tiers JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function normalizeTiers(tiers: LoyaltyTier[]): LoyaltyTier[] {
  return tiers.map(tier => ({
    name: tier.name.trim(),
    min_points: tier.min_points,
    perks: [...new Set(tier.perks)],
  }));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    getTierQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureLoyaltyTierSchema();

    const { creator } = queryResult.data;
    const { rows } = await sql`
      SELECT
        u.id,
        u.username,
        t.tiers
      FROM users u
      LEFT JOIN route_f_loyalty_tiers t
        ON t.creator_id = u.id
      WHERE LOWER(u.username) = LOWER(${creator})
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const row = rows[0];
    const tiers = Array.isArray(row.tiers) ? row.tiers : DEFAULT_TIERS;

    return NextResponse.json({
      creator: row.username,
      tiers,
    });
  } catch (error) {
    console.error("[routes-f loyalty/tiers GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch loyalty tiers" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, updateTierSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const tiers = normalizeTiers(bodyResult.data.tiers);

  try {
    await ensureLoyaltyTierSchema();

    const { rows } = await sql`
      INSERT INTO route_f_loyalty_tiers (creator_id, tiers, updated_at)
      VALUES (${session.userId}, ${JSON.stringify(tiers)}::jsonb, NOW())
      ON CONFLICT (creator_id)
      DO UPDATE SET
        tiers = EXCLUDED.tiers,
        updated_at = NOW()
      RETURNING creator_id, tiers, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[routes-f loyalty/tiers PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update loyalty tiers" },
      { status: 500 }
    );
  }
}
