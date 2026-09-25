import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export type ChangeDirection = "up" | "down" | "none";

export interface PercentageChangeResult {
  percent_change: number | null;
  absolute_change: number;
  direction: ChangeDirection;
}

/**
 * Compute percentage change, absolute change, and direction between two numbers.
 * When `from` is 0 the percentage is undefined (returned as null), except when
 * `to` is also 0 (no change → 0%).
 */
export function computePercentageChange(
  from: number,
  to: number,
): PercentageChangeResult {
  const absolute_change = to - from;
  const direction: ChangeDirection =
    absolute_change > 0 ? "up" : absolute_change < 0 ? "down" : "none";

  let percent_change: number | null;
  if (from === 0) {
    percent_change = to === 0 ? 0 : null;
  } else {
    percent_change = (absolute_change / Math.abs(from)) * 100;
  }

  return { percent_change, absolute_change, direction };
}

const schema = z.object({
  from: z.number().finite(),
  to: z.number().finite(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {return result;}
  const { from, to } = result.data;
  return NextResponse.json(computePercentageChange(from, to));
}
