// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// DB schema (apply via migration):
//
// ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
// ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by   UUID REFERENCES users(id);
//
// CREATE TABLE referral_rewards (
//   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   referrer_id   UUID REFERENCES users(id),
//   referred_id   UUID REFERENCES users(id),
//   trigger       TEXT NOT NULL,  -- 'signup' | 'first_earnings' | 'milestone_100usd'
//   reward_usdc   NUMERIC(10,2),
//   tx_hash       TEXT,
//   created_at    TIMESTAMPTZ DEFAULT now()
// );
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * Generates a referral code: first 6 chars of username + 4 random alphanumeric chars.
 * e.g. 'alice-X7K2'
 */
export function generateReferralCode(username: string): string {
  const base = username.slice(0, 6).toLowerCase();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 4 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
  return `${base}-${suffix}`;
}

/**
 * GET /api/routes-f/referrals
 * Returns the authenticated user's referral code, share URL, and stats.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch or lazily create a referral code
  const { rows: userRows } = await db.query(
    `SELECT id, username, referral_code FROM users WHERE id = $1`,
    [user.id]
  );

  if (userRows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let { referral_code } = userRows[0];

  if (!referral_code) {
    referral_code = generateReferralCode(userRows[0].username);
    await db.query(`UPDATE users SET referral_code = $1 WHERE id = $2`, [
      referral_code,
      user.id,
    ]);
  }

  // Aggregate stats
  const { rows: statsRows } = await db.query(
    `SELECT
       COUNT(DISTINCT u.id)                                           AS total_referred,
       COUNT(DISTINCT CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN u.id END) AS active_referrals,
       COALESCE(SUM(rr.reward_usdc), 0)                              AS total_earned_usdc,
       COALESCE(SUM(CASE WHEN rr.tx_hash IS NULL THEN rr.reward_usdc END), 0) AS pending_usdc
     FROM users u
     LEFT JOIN referral_rewards rr ON rr.referrer_id = $1 AND rr.referred_id = u.id
     WHERE u.referred_by = $1`,
    [user.id]
  );

  // Individual referrals list
  const { rows: referrals } = await db.query(
    `SELECT u.username, u.created_at AS joined_at,
            CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN 'active' ELSE 'inactive' END AS status,
            COALESCE(SUM(rr.reward_usdc), 0) AS earned_usdc
     FROM users u
     LEFT JOIN referral_rewards rr ON rr.referrer_id = $1 AND rr.referred_id = u.id
     WHERE u.referred_by = $1
     GROUP BY u.id, u.username, u.created_at
     ORDER BY u.created_at DESC`,
    [user.id]
  );

  const stats = statsRows[0];

  return NextResponse.json({
    code: referral_code,
    share_url: `https://www.streamfi.media/join?ref=${referral_code}`,
    stats: {
      total_referred: Number(stats.total_referred),
      active_referrals: Number(stats.active_referrals),
      total_earned_usdc: String(Number(stats.total_earned_usdc).toFixed(2)),
      pending_usdc: String(Number(stats.pending_usdc).toFixed(2)),
    },
    referrals: referrals.map((r) => ({
      username: r.username,
      joined_at: r.joined_at,
      status: r.status,
      earned_usdc: String(Number(r.earned_usdc).toFixed(2)),
    })),
  });
}

// Stub in-memory store for apply route compatibility
export const USERS_STORE = new Map<string, Record<string, unknown>>();
