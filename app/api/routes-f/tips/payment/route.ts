import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";
import { insertActivityEvent } from "@/app/api/routes-f/activity/_lib/insert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  creator_id: z.string().uuid(),
  amount: z.string().min(1),
  currency: z.enum(["XLM", "USDC"]),
  tx_hash: z.string().min(1),
});

/**
 * Practice tip payment route — records tip_received + tip_sent activity events.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, paymentSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { creator_id, amount, currency, tx_hash } = bodyResult.data;

  if (creator_id === session.userId) {
    return NextResponse.json(
      { error: "Cannot tip yourself" },
      { status: 400 }
    );
  }

  try {
    const metadata = { amount, currency, tx_hash };

    const [received, sent] = await Promise.all([
      insertActivityEvent({
        userId: creator_id,
        type: "tip_received",
        actorId: session.userId,
        metadata,
      }),
      insertActivityEvent({
        userId: session.userId,
        type: "tip_sent",
        actorId: creator_id,
        metadata,
      }),
    ]);

    return NextResponse.json(
      {
        tip_received_event_id: received.id,
        tip_sent_event_id: sent.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f tips/payment POST]", error);
    return NextResponse.json(
      { error: "Failed to record tip activity" },
      { status: 500 }
    );
  }
}
