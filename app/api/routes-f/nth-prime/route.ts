import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { findNthPrime } from "@/app/api/routes-f/_lib/prime";

const querySchema = z.object({
  n: z.string(),
});

export async function GET(req: NextRequest) {
  const validated = validateQuery(req.nextUrl.searchParams, querySchema);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const n = Number(validated.data.n);
  if (!Number.isInteger(n) || n < 1 || n > 100000) {
    return NextResponse.json(
      { error: "n must be an integer between 1 and 100000." },
      { status: 400 }
    );
  }

  try {
    const prime = findNthPrime(n);
    return NextResponse.json({ n, prime });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute nth prime." },
      { status: 400 }
    );
  }
}
