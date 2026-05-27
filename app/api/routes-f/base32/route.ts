import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 encode of a UTF-8 string. */
export function base32Encode(input: string, padding = true): string {
  const bytes = new TextEncoder().encode(input);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = ((value << 8) | b) >>> 0;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31];
  }
  if (padding) {
    while (out.length % 8 !== 0) out += "=";
  }
  return out;
}

/** RFC 4648 base32 decode back to a UTF-8 string. Throws on invalid input. */
export function base32Decode(input: string): string {
  const clean = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new RangeError(`invalid base32 character: ${ch}`);
    }
    value = ((value << 5) | idx) >>> 0;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

const schema = z.object({
  input: z.string(),
  mode: z.enum(["encode", "decode"]),
  padding: z.boolean().optional().default(true),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { input, mode, padding } = result.data;

  if (mode === "encode") {
    return NextResponse.json({ output: base32Encode(input, padding) });
  }
  try {
    return NextResponse.json({ output: base32Decode(input) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid base32 input" },
      { status: 400 },
    );
  }
}
