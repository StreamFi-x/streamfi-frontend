/**
 * POST /api/auth/recovery/setup
 *
 * Initiates secondary recovery email setup for authenticated wallet users.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { setupRecoveryEmail } from "@/lib/auth/wallet-recovery";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isRateLimited = createRateLimiter(15 * 60 * 1000, 5); // 5 setups per 15 min

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Valid recovery email address is required" },
        { status: 400 }
      );
    }

    const { verificationCode } = await setupRecoveryEmail(session.userId, email);

    // In production, send via Nodemailer / Sendgrid. In test/dev, return status ok.
    return NextResponse.json({
      ok: true,
      message: "Verification code sent to recovery email address",
      // Code returned in non-prod for automated verification testing
      ...(process.env.NODE_ENV !== "production" ? { debugCode: verificationCode } : {}),
    });
  } catch (err) {
    console.error("[recovery/setup] Error setting up recovery:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
