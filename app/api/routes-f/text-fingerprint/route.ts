import { type NextRequest, NextResponse } from "next/server";
import { parseAndFingerprint } from "./_lib/helpers";
import type { FingerprintResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = parseAndFingerprint(body);
    return NextResponse.json(result satisfies FingerprintResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to compute fingerprint.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
