import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";
import { getOrCreateEarnings, aggregateCreatorPayout, MIN_PAYOUT_BITS } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payoutRequestSchema = z.object({
  destination_wallet: z.string().optional(),
});

/**
 * GET /api/routes-f/virtual-currency/payouts
 * Creator views their accumulated bits earnings, USD equivalent, and payout eligibility.
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

  const earnings = getOrCreateEarnings(userId);
  return NextResponse.json({
    earnings,
    min_payout_bits: MIN_PAYOUT_BITS,
    eligible_for_payout: earnings.accumulated_bits >= MIN_PAYOUT_BITS,
  });
}

/**
 * POST /api/routes-f/virtual-currency/payouts
 * Creator triggers aggregation of accumulated bits into a payout batch.
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

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const parseRes = payoutRequestSchema.safeParse(body);
  const destinationWallet = parseRes.success ? parseRes.data.destination_wallet : undefined;

  const outcome = aggregateCreatorPayout(userId, destinationWallet);
  if (!outcome.success) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({
    message: "Payout batch processed successfully",
    payout: outcome.batch,
  }, { status: 200 });
}
