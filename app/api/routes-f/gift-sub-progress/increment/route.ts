/**
 * POST /api/routes-f/gift-sub-progress/increment
 * Body: { stream_id: string; by?: number }
 * Increments the gift-sub counter and returns updated progress.
 */
import { NextRequest, NextResponse } from "next/server";
import { giftCounts, computeProgress } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stream_id, by } = (body ?? {}) as Record<string, unknown>;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  if (!giftCounts.has(stream_id)) {
    return NextResponse.json({ error: `unknown stream_id: ${stream_id}` }, { status: 404 });
  }

  const increment = typeof by === "number" && Number.isInteger(by) && by > 0 ? by : 1;
  const newCount = giftCounts.get(stream_id)! + increment;
  giftCounts.set(stream_id, newCount);

  return NextResponse.json(computeProgress(newCount));
}
