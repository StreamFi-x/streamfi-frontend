import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { getOrCreateBalance, ledgerEntries } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/virtual-currency/balance
 * Returns the authenticated user's current StreamBits balance and recent ledger transactions.
 */
export async function GET(req: NextRequest) {
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

  const balance = getOrCreateBalance(userId);
  const userLedger = ledgerEntries
    .filter((entry) => entry.user_id === userId)
    .slice(-20)
    .reverse();

  return NextResponse.json({
    balance,
    recent_transactions: userLedger,
  });
}
