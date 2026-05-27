import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

/**
 * Atbash cipher: maps each Latin letter to its mirror (a<->z, A<->Z). It is its
 * own inverse, so encoding and decoding are identical.
 */
export function atbash(text: string): string {
  return text
    .replace(/[a-z]/g, (c) => String.fromCharCode(219 - c.charCodeAt(0)))
    .replace(/[A-Z]/g, (c) => String.fromCharCode(155 - c.charCodeAt(0)));
}

/** Index of the zig-zag rail each character lands on, for a given length. */
function railPattern(length: number, rails: number): number[] {
  const pattern: number[] = [];
  let row = 0;
  let dir = 1;
  for (let i = 0; i < length; i += 1) {
    pattern.push(row);
    if (row === 0) dir = 1;
    else if (row === rails - 1) dir = -1;
    row += dir;
  }
  return pattern;
}

export function railFenceEncode(text: string, rails: number): string {
  const rows: string[] = Array.from({ length: rails }, () => "");
  const pattern = railPattern(text.length, rails);
  for (let i = 0; i < text.length; i += 1) {
    rows[pattern[i]] += text[i];
  }
  return rows.join("");
}

export function railFenceDecode(cipher: string, rails: number): string {
  const pattern = railPattern(cipher.length, rails);

  const perRail = Array.from({ length: rails }, (_, r) =>
    pattern.filter((p) => p === r).length,
  );
  const railStrings: string[] = [];
  let idx = 0;
  for (let r = 0; r < rails; r += 1) {
    railStrings.push(cipher.slice(idx, idx + perRail[r]));
    idx += perRail[r];
  }

  const railCursor = new Array(rails).fill(0);
  let out = "";
  for (let i = 0; i < cipher.length; i += 1) {
    const r = pattern[i];
    out += railStrings[r][railCursor[r]];
    railCursor[r] += 1;
  }
  return out;
}

const schema = z
  .object({
    text: z.string(),
    cipher: z.enum(["atbash", "railfence"]),
    rails: z.number().int().min(2).optional(),
    mode: z.enum(["encode", "decode"]),
  })
  .refine((v) => v.cipher !== "railfence" || v.rails !== undefined, {
    message: "rails (>= 2) is required for the railfence cipher",
    path: ["rails"],
  });

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { text, cipher, rails, mode } = result.data;

  let output: string;
  if (cipher === "atbash") {
    // Symmetric — mode does not change the result.
    output = atbash(text);
  } else {
    output =
      mode === "encode"
        ? railFenceEncode(text, rails as number)
        : railFenceDecode(text, rails as number);
  }

  return NextResponse.json({ result: output });
}
