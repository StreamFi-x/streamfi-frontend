import { type NextRequest, NextResponse } from "next/server";
import { parseAndGenerate } from "./_lib/helpers";
import type { NanoidResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = parseAndGenerate(body);
    return NextResponse.json(result satisfies NanoidResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate IDs.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
