// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/routes-f/referrals/[code]
 * Public endpoint: validates whether a referral code exists.
 * Used by the onboarding page to verify a ?ref= param.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const { rows } = await db.query(
    `SELECT id, username FROM users WHERE referral_code = $1`,
    [code]
  );

  if (rows.length === 0) {
    return NextResponse.json({ valid: false, error: "Invalid referral code" }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    referrer: rows[0].username,
  });
}

/**
 * POST /api/routes-f/referrals/[code]/apply
 * Apply a referral code for the authenticated user.
 * Can only be applied once and within 24h of signup.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await context.params;

  // Ensure the current user hasn't already been referred
  const { rows: currentUser } = await db.query(
    `SELECT id, referred_by, created_at FROM users WHERE id = $1`,
    [user.id]
  );

  if (currentUser.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (currentUser[0].referred_by) {
    return NextResponse.json(
      { error: "Referral code has already been applied" },
      { status: 409 }
    );
  }

  // Enforce 24h signup window
  const signedUpAt = new Date(currentUser[0].created_at);
  const hoursSinceSignup =
    (Date.now() - signedUpAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceSignup > 24) {
    return NextResponse.json(
      { error: "Referral code can only be applied within 24 hours of signup" },
      { status: 403 }
    );
  }

  // Resolve referral code to a referrer
  const { rows: referrer } = await db.query(
    `SELECT id FROM users WHERE referral_code = $1`,
    [code]
  );

  if (referrer.length === 0) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
  }

  // Prevent self-referral
  if (referrer[0].id === user.id) {
    return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
  }

  await db.query(`UPDATE users SET referred_by = $1 WHERE id = $2`, [
    referrer[0].id,
    user.id,
  ]);

  return NextResponse.json({ success: true, message: "Referral code applied" });
}
