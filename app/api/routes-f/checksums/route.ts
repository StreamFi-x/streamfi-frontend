import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const toHex8 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");

/** CRC32 (IEEE 802.3) of UTF-8 encoded input, returned as 8-digit hex. */
export function crc32(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return toHex8(crc ^ 0xffffffff);
}

/** Adler-32 of UTF-8 encoded input, returned as 8-digit hex. */
export function adler32(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const MOD = 65521;
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % MOD;
    b = (b + a) % MOD;
  }
  return toHex8((b << 16) | a);
}

export type ChecksumAlgorithm = "crc32" | "adler32" | "both";

export function checksums(
  input: string,
  algorithm: ChecksumAlgorithm = "both",
): { crc32?: string; adler32?: string } {
  const out: { crc32?: string; adler32?: string } = {};
  if (algorithm === "crc32" || algorithm === "both") out.crc32 = crc32(input);
  if (algorithm === "adler32" || algorithm === "both") out.adler32 = adler32(input);
  return out;
}

const schema = z.object({
  input: z.string(),
  algorithm: z.enum(["crc32", "adler32", "both"]).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { input, algorithm } = result.data;
  return NextResponse.json(checksums(input, algorithm));
}
