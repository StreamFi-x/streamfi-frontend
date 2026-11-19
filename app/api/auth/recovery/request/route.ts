/**
 * POST /api/auth/recovery/request
 *
 * Requests account recovery for a lost key.
 * If the user configured a verified recovery email, generates an authorization challenge.
 */

import { NextRequest, NextResponse } from "next/server";
import { requestAccountRecovery } from "@/lib/auth/wallet-recovery";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isRateLimited = createRateLimiter(15 * 60 * 1000, 3); // Max 3 recovery requests per 15 min per IP

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many recovery attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  try {
    const { identifier, newWallet } = await req.json();
    if (!identifier || !newWallet) {
      return NextResponse.json(
        { error: "Username/Old Wallet and New Stellar Wallet address are required" },
        { status: 400 }
      );
    }

    if (!/^G[A-Z2-7]{55}$/.test(newWallet)) {
      return NextResponse.json(
        { error: "Invalid new Stellar wallet public key format" },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") ?? undefined;
    const result = await requestAccountRecovery(
      identifier.trim(),
      newWallet.trim(),
      ip === "unknown" ? undefined : ip,
      userAgent
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason || "Recovery request failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Recovery authorization token dispatched to ${result.maskedEmail}`,
      maskedEmail: result.maskedEmail,
      ...(process.env.NODE_ENV !== "production"
        ? { debugToken: result.recoveryToken }
        : {}),
    });
  } catch (err) {
    console.error("[recovery/request] Error initiating recovery:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
