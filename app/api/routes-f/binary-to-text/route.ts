import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const schema = z.object({
  input: z.string(),
  mode: z.enum(["to_binary", "from_binary"]),
  bits: z.number().int().positive().optional().default(8),
});

/** Encode a UTF-8 string to space-separated binary groups. */
export function toBinary(input: string, bits: number): string {
  const bytes = new TextEncoder().encode(input);
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(bits, "0"))
    .join(" ");
}

/** Decode space-separated binary groups back to a UTF-8 string. */
export function fromBinary(input: string, bits: number): string {
  const groups = input.trim().split(/\s+/);

  for (const g of groups) {
    if (!/^[01]+$/.test(g)) {
      throw new Error(`Invalid binary token: "${g}"`);
    }
    if (g.length !== bits) {
      throw new Error(`Token "${g}" has ${g.length} bits, expected ${bits}`);
    }
  }

  const bytes = new Uint8Array(groups.map((g) => parseInt(g, 2)));
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;

  const { input, mode, bits } = result.data;

  try {
    const output = mode === "to_binary" ? toBinary(input, bits) : fromBinary(input, bits);
    return NextResponse.json({ result: output });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Conversion failed" },
      { status: 400 }
    );
  }
}
