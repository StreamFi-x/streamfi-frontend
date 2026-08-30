import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const MAX_INPUT_BYTES = 1_000_000;
const DEFAULT_BYTES_PER_LINE = 16;

/**
 * Produce a classic hex dump (8-digit hex offset, space-separated hex bytes, and
 * an ASCII gutter) of UTF-8 encoded `input`. Non-printable bytes render as `.`.
 */
export function hexDump(input: string, bytesPerLine = DEFAULT_BYTES_PER_LINE): string {
  const bytes = new TextEncoder().encode(input);
  const lines: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
    const slice = bytes.subarray(offset, offset + bytesPerLine);

    const hex = Array.from(slice, (b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(bytesPerLine * 3 - 1, " ");

    const ascii = Array.from(slice, (b) =>
      b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".",
    ).join("");

    lines.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  |${ascii}|`);
  }

  return lines.join("\n");
}

const schema = z.object({
  input: z.string().max(MAX_INPUT_BYTES, "input exceeds 1MB limit"),
  bytes_per_line: z.number().int().min(1).max(64).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {return result;}
  const { input, bytes_per_line } = result.data;
  return NextResponse.json({
    dump: hexDump(input, bytes_per_line ?? DEFAULT_BYTES_PER_LINE),
  });
}
