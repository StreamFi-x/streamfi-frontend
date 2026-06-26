import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refundRequests, RefundRequest } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResolvedRequest = RefundRequest & {
  resolved_status?: string;
  resolved_by?: string;
  note?: string | null;
  resolved_at?: string;
};

const resolveSchema = z.object({
  request_id: z.string().min(1),
  decision: z.enum(["approve", "deny"]),
  creator_id: z.string().min(1),
  note: z.string().optional(),
});

/**
 * POST /api/routes-f/tip-refund/resolve
 * Creator approves or denies a refund request
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { request_id, decision, creator_id, note } = parsed.data;

  const request = refundRequests.find((r) => r.request_id === request_id) as ResolvedRequest | undefined;
  if (!request) {
    return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
  }

  if (request.resolved_status) {
    return NextResponse.json({ error: "Refund request already resolved" }, { status: 409 });
  }

  request.resolved_status = decision;
  request.resolved_by = creator_id;
  request.note = note ?? null;
  request.resolved_at = new Date().toISOString();

  return NextResponse.json({ request_id, decision, note: note ?? null });
}
