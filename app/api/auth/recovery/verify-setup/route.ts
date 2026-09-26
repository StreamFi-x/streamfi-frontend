/**
 * POST /api/auth/recovery/verify-setup
 *
 * Confirms the 6-digit verification code to activate the recovery method.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { verifyRecoverySetup } from "@/lib/auth/wallet-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return NextResponse.json(
        { error: "6-digit verification code is required" },
        { status: 400 }
      );
    }

    const result = await verifyRecoverySetup(session.userId, code.trim());
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason || "Invalid verification code" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Recovery email verified and enabled successfully.",
    });
  } catch (err) {
    console.error("[recovery/verify-setup] Error verifying code:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
