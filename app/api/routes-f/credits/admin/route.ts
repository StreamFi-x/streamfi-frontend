import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureCreditsSchema } from "../route";

const issueVoucherSchema = z.object({
  amount_usd: z.number().positive(),
  max_redemptions: z.number().int().min(1).default(1),
  expires_at: z.string().datetime().optional(),
});

async function isAdmin(userId: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM users WHERE id = ${userId} AND is_admin = TRUE LIMIT 1
  `;
  return rows.length > 0;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * GET /api/routes-f/credits/admin
 * Admin — list all issued voucher codes and their redemption status.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  if (!(await isAdmin(session.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await ensureCreditsSchema();

    const { rows } = await sql`
      SELECT
        v.id,
        v.code,
        v.amount_usd,
        v.max_redemptions,
        v.redemption_count,
        v.expires_at,
        v.created_at,
        COALESCE(
          json_agg(
            json_build_object('user_id', r.user_id, 'redeemed_at', r.redeemed_at)
          ) FILTER (WHERE r.user_id IS NOT NULL),
          '[]'
        ) AS redemptions
      FROM route_f_vouchers v
      LEFT JOIN route_f_voucher_redemptions r ON r.voucher_id = v.id
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `;

    return NextResponse.json({ vouchers: rows });
  } catch (error) {
    console.error("[routes-f credits/admin GET]", error);
    return NextResponse.json({ error: "Failed to fetch vouchers" }, { status: 500 });
  }
}

/**
 * POST /api/routes-f/credits/admin
 * Admin — issue a new voucher code.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  if (!(await isAdmin(session.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await validateBody(req, issueVoucherSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { amount_usd, max_redemptions, expires_at } = bodyResult.data;

  if (expires_at && new Date(expires_at) <= new Date()) {
    return NextResponse.json({ error: "expires_at must be in the future" }, { status: 400 });
  }

  try {
    await ensureCreditsSchema();

    // Retry on rare code collision
    let rows: Record<string, unknown>[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        const result = await sql`
          INSERT INTO route_f_vouchers (code, amount_usd, max_redemptions, expires_at)
          VALUES (${code}, ${amount_usd}, ${max_redemptions}, ${expires_at ?? null})
          RETURNING id, code, amount_usd, max_redemptions, redemption_count, expires_at, created_at
        `;
        rows = result.rows;
        break;
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === "23505" && attempt < 4) continue; // unique violation, retry
        throw e;
      }
    }

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f credits/admin POST]", error);
    return NextResponse.json({ error: "Failed to issue voucher" }, { status: 500 });
  }
}
