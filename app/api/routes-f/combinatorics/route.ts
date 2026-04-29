import { NextRequest, NextResponse } from "next/server";
import {
  countCombinatorics,
  enumerateCombinations,
  enumeratePermutations,
  validateRequest,
} from "./_lib/combinatorics";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateRequest((body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.mode === "count") {
    return NextResponse.json({
      value: countCombinatorics(parsed.n, parsed.r, parsed.type).toString(),
    });
  }

  const results =
    parsed.type === "combination"
      ? enumerateCombinations(parsed.items, parsed.r)
      : enumeratePermutations(parsed.items, parsed.r);

  return NextResponse.json({ results });
}
