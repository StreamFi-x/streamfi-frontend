// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { USERS_STORE } from "../../route";

// ---------------------------------------------------------------------------
// POST /api/routes-f/referrals/[code]/apply
// Called during onboarding when ?ref= query param is present
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  // Resolve current user
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const user = USERS_STORE.get(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Can only be applied once
  if (user.referred_by) {
    return NextResponse.json(
      { error: "Referral code already applied." },
      { status: 409 }
    );
  }

  // Must be within 24h of signup
  const hoursSinceSignup =
    (Date.now() - user.created_at) / (1000 * 60 * 60);
  if (hoursSinceSignup > 24) {
    return NextResponse.json(
      { error: "Referral window expired. Must be applied within 24h of signup." },
      { status: 400 }
    );
  }

  // Resolve referrer
  const { code } = await context.params;
  const referrer = Array.from(USERS_STORE.values()).find(
    (u) => u.referral_code === code
  );

  if (!referrer) {
    return NextResponse.json(
      { error: "Invalid referral code." },
      { status: 404 }
    );
  }

  if (referrer.id === userId) {
    return NextResponse.json(
      { error: "Cannot apply your own referral code." },
      { status: 400 }
    );
  }

  // Apply referral
  user.referred_by = referrer.id;

  return NextResponse.json(
    { success: true, message: `Referral code '${code}' applied.` },
    { status: 200 }
  );
}
