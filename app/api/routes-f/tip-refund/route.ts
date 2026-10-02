import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface TipRecord {
  tip_id: string;
  tipper_id: string;
  amount_usdc: number;
  ts: string;
}

export interface RefundRequest {
  request_id: string;
  tip_id: string;
  tipper_id: string;
  reason: string;
  status: "pending";
  created_at: string;
}

export const SEED_TIPS: Record<string, TipRecord> = {
  "tip-001": { tip_id: "tip-001", tipper_id: "viewer-1", amount_usdc: 5.0, ts: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
  "tip-002": { tip_id: "tip-002", tipper_id: "viewer-2", amount_usdc: 10.0, ts: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
  "tip-003": { tip_id: "tip-003", tipper_id: "viewer-3", amount_usdc: 2.5, ts: new Date(Date.now() - 30 * 3600 * 1000).toISOString() },
};

export const refundRequests: RefundRequest[] = [];

let requestCounter = 1;

const requestSchema = z.object({
  tip_id: z.string().min(1),
  tipper_id: z.string().min(1),
  reason: z.string().min(1),
});

/**
 * POST /api/routes-f/tip-refund
 * Submit a refund request for a recent tip
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { tip_id, tipper_id, reason } = parsed.data;

  const tip = SEED_TIPS[tip_id];
  if (!tip) {
    return NextResponse.json({ error: "Tip not found" }, { status: 404 });
  }

  const age = Date.now() - new Date(tip.ts).getTime();
  if (age > REFUND_WINDOW_MS) {
    return NextResponse.json(
      { error: "Tip is older than 24 hours and is not eligible for refund" },
      { status: 400 }
    );
  }

  if (tip.tipper_id !== tipper_id) {
    return NextResponse.json({ error: "Tipper ID does not match" }, { status: 403 });
  }


  const request_id = `req-${String(requestCounter++).padStart(4, "0")}`;
  const entry: RefundRequest = {
    request_id,
    tip_id,
    tipper_id,
    reason,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  refundRequests.push(entry);

  return NextResponse.json({ request_id, status: "pending" }, { status: 201 });
}
