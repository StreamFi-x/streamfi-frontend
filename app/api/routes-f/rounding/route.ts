import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export type RoundingMode = "half_up" | "half_even" | "ceil" | "floor" | "trunc";

/** Banker's rounding (round half to even). */
function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // exactly .5 → round to the even neighbour
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Round `value` to `decimals` places using the given strategy. */
export function roundValue(value: number, mode: RoundingMode, decimals = 0): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  let r: number;
  switch (mode) {
    case "ceil":
      r = Math.ceil(scaled);
      break;
    case "floor":
      r = Math.floor(scaled);
      break;
    case "trunc":
      r = Math.trunc(scaled);
      break;
    case "half_up":
      // round half away from zero
      r = Math.sign(scaled) * Math.round(Math.abs(scaled));
      break;
    case "half_even":
      r = roundHalfEven(scaled);
      break;
  }
  return r / factor;
}

const schema = z.object({
  value: z.number().finite(),
  mode: z.enum(["half_up", "half_even", "ceil", "floor", "trunc"]),
  decimals: z.number().int().min(0).max(15).optional().default(0),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { value, mode, decimals } = result.data;
  return NextResponse.json({ result: roundValue(value, mode, decimals), mode });
}
