import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Simulated in-memory store (replace with Postgres + Stellar SDK in production)
// ---------------------------------------------------------------------------
type User = {
  id: string;
  username: string;
  referral_code: string;
  referred_by: string | null;
  created_at: number; // epoch ms
  total_earnings_usd: number;
};

type ReferralReward = {
  id: string;
  referrer_id: string;
  referred_id: string;
  trigger: "signup" | "first_earnings" | "milestone_100usd";
  reward_usdc: number;
  tx_hash: string | null;
  created_at: number;
};

export const USERS_STORE: Map<string, User> = new Map();
export const REWARDS_STORE: ReferralReward[] = [];

// Seed a demo user
const DEMO_USER: User = {
  id: "user-demo-0001",
  username: "alice",
  referral_code: "alice-X7K2",
  referred_by: null,
  created_at: Date.now() - 1000 * 60 * 60 * 24 * 10,
  total_earnings_usd: 0,
};
USERS_STORE.set(DEMO_USER.id, DEMO_USER);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateReferralCode(username: string): string {
  const prefix = username.slice(0, 6).toLowerCase();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 4 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
  return `${prefix}-${suffix}`;
}

function getCurrentUserId(request: NextRequest): string | null {
  // In production: decode JWT / session cookie.
  // For demo, accept X-User-Id header.
  return request.headers.get("x-user-id");
}

function buildShareUrl(code: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.streamfi.media";
  return `${base}/join?ref=${code}`;
}

// ---------------------------------------------------------------------------
// GET /api/routes-f/referrals  — current user's referral code + stats
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const user = USERS_STORE.get(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Ensure referral code exists (idempotent generation)
  if (!user.referral_code) {
    user.referral_code = generateReferralCode(user.username);
  }

  // Build referral list
  const referred = Array.from(USERS_STORE.values()).filter(
    (u) => u.referred_by === userId
  );

  const myRewards = REWARDS_STORE.filter((r) => r.referrer_id === userId);
  const totalEarnedUsdc = myRewards.reduce((s, r) => s + r.reward_usdc, 0);
  const pendingUsdc = myRewards
    .filter((r) => !r.tx_hash)
    .reduce((s, r) => s + r.reward_usdc, 0);

  const referrals = referred.map((u) => {
    const earned = myRewards
      .filter((r) => r.referred_id === u.id)
      .reduce((s, r) => s + r.reward_usdc, 0);
    return {
      username: u.username,
      joined_at: new Date(u.created_at).toISOString(),
      status: u.total_earnings_usd >= 10 ? "active" : "pending",
      earned_usdc: earned.toFixed(2),
    };
  });

  return NextResponse.json({
    code: user.referral_code,
    share_url: buildShareUrl(user.referral_code),
    stats: {
      total_referred: referred.length,
      active_referrals: referred.filter((u) => u.total_earnings_usd >= 10)
        .length,
      total_earned_usdc: totalEarnedUsdc.toFixed(2),
      pending_usdc: pendingUsdc.toFixed(2),
    },
    referrals,
  });
}
