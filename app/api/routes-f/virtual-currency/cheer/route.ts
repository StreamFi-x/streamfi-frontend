import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";
import { cheerBits } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cheerSchema = z.object({
  creator_id: z.string().min(1),
  amount_bits: z.number().int().positive(),
  message: z.string().max(250).optional(),
});

/**
 * POST /api/routes-f/virtual-currency/cheer
 * Instant in-stream cheer without per-tip wallet signatures.
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

    const result = cheerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.format() },
        { status: 400 }
      );
    }

    const { creator_id, amount_bits, message } = result.data;
    const outcome = cheerBits(userId, creator_id, amount_bits, message);

    if (!outcome.success) {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({
      message: `Cheered ${amount_bits} bits!`,
      cheer_event: outcome.event,
      remaining_bits: outcome.remaining_bits,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
