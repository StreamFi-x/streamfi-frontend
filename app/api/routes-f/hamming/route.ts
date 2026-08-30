import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

/**
 * Hamming distance: the number of positions at which two equal-length strings
 * differ. Throws if the inputs are not the same length.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new RangeError("inputs must be of equal length");
  }
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {distance += 1;}
  }
  return distance;
}

const schema = z.object({
  a: z.string(),
  b: z.string(),
  mode: z.enum(["string", "binary"]).optional().default("string"),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {return result;}
  const { a, b, mode } = result.data;

  if (mode === "binary" && (!/^[01]+$/.test(a) || !/^[01]+$/.test(b))) {
    return NextResponse.json(
      { error: "binary mode requires inputs containing only 0 and 1" },
      { status: 400 },
    );
  }

  if (a.length !== b.length) {
    return NextResponse.json(
      { error: "inputs must be of equal length" },
      { status: 400 },
    );
  }

  return NextResponse.json({ distance: hammingDistance(a, b) });
}
