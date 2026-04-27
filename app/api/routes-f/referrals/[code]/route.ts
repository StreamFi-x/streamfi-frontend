import { NextRequest, NextResponse } from "next/server";
import { USERS_STORE, REWARDS_STORE } from "../route";

// ---------------------------------------------------------------------------
// GET /api/routes-f/referrals/[code]  — public code validation
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  const referrer = Array.from(USERS_STORE.values()).find(
    (u) => u.referral_code === code
  );

  if (!referrer) {
    return NextResponse.json(
      { valid: false, error: "Referral code not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    valid: true,
    referrer_username: referrer.username,
    code,
  });
}
