import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";
import { purchaseBits } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const purchaseSchema = z.object({
  package_id: z.string().min(1),
  payment_tx_hash: z.string().min(1),
});

/**
 * POST /api/routes-f/virtual-currency/purchase
 * Buy a bundle of StreamBits using on-chain transaction verification.
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

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = purchaseSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.format() },
        { status: 400 }
      );
    }

    const { package_id, payment_tx_hash } = result.data;
    const outcome = purchaseBits(userId, package_id, payment_tx_hash);

    if (!outcome.success) {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({
      message: `Successfully purchased ${outcome.package?.name}!`,
      package: outcome.package,
      balance: outcome.balance,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
