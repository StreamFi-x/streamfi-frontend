import { NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const MAX_STEPS = 10000;

export interface CollatzResult {
  sequence: number[];
  steps: number;
  max_value: number;
}

/**
 * Generate the Collatz sequence for a positive integer `n`: repeatedly halve
 * if even, else 3n+1, until reaching 1. Capped at MAX_STEPS to bound output.
 */
export function collatz(n: number): CollatzResult {
  const sequence: number[] = [n];
  let current = n;
  let steps = 0;
  let maxValue = n;

  while (current !== 1 && steps < MAX_STEPS) {
    current = current % 2 === 0 ? current / 2 : 3 * current + 1;
    sequence.push(current);
    if (current > maxValue) maxValue = current;
    steps += 1;
  }

  return { sequence, steps, max_value: maxValue };
}

const schema = z.object({
  n: z.coerce.number().int().positive(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const result = validateQuery(searchParams, schema);
  if (result instanceof NextResponse) return result;
  return NextResponse.json(collatz(result.data.n));
}
