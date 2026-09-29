/**
 * POST /api/auth/recovery/execute
 *
 * Executes account recovery using the verified token and rebinds the account
 * to the new Stellar wallet address.
 */

import { NextRequest, NextResponse } from "next/server";
import { executeAccountRecovery } from "@/lib/auth/wallet-recovery";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isRateLimited = createRateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 min

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { token, newWallet } = await req.json();
    if (!token || !newWallet) {
      return NextResponse.json(
        { error: "Recovery token and new wallet address are required" },
        { status: 400 }
      );
    }

    const result = await executeAccountRecovery(token.trim(), newWallet.trim());
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason || "Recovery execution failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Account successfully recovered and rebound to new wallet address.",
      userId: result.userId,
    });
  } catch (err) {
    console.error("[recovery/execute] Error executing recovery:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
