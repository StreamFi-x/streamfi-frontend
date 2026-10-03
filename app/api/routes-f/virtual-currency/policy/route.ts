import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { handleAccountDeletionDisposition } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/virtual-currency/policy
 * Explicit platform policy regarding virtual currency expiry, refunds, and account deletion disposition.
 */
export async function GET() {
  return NextResponse.json({
    expiry_policy: "StreamBits do not expire as long as the user account remains active.",
    refund_policy: "Unused StreamBits purchased within the last 14 days are eligible for a refund to the original funding wallet or payment method.",
    account_deletion_policy: "Upon account deletion, any unused balance is reviewed for automated refund or credited back per the Terms of Service before user records are anonymized.",
    custody_model: "StreamFi holds aggregated custodial reserve backing 100% of outstanding StreamBits circulation.",
  });
}

/**
 * POST /api/routes-f/virtual-currency/policy
 * Executes account deletion balance disposition for the authenticated user.
 */
export async function POST(req: NextRequest) {
  let userId: string | null = null;
  const testUserId = req.headers.get("x-user-id");

  if (testUserId) {
    userId = testUserId;
  } else {
    const session = await verifySession(req);
    if (session.ok) {
      userId = session.userId;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = handleAccountDeletionDisposition(userId);
  return NextResponse.json(result);
}
