import { NextRequest, NextResponse } from "next/server";
import { encodeBase64, decodeBase64, validateInput } from "./_lib/helpers";
import type { Base64Request, Base64Response } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: Base64Request;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { input, mode, variant = "standard", padding = true } = body;

  if (typeof input !== "string") {
    return NextResponse.json({ error: "input must be a string." }, { status: 400 });
  }

  if (!["encode", "decode"].includes(mode)) {
    return NextResponse.json({ error: "mode must be 'encode' or 'decode'." }, { status: 400 });
  }

  if (!["standard", "urlsafe"].includes(variant)) {
    return NextResponse.json(
      { error: "variant must be 'standard' or 'urlsafe'." },
      { status: 400 }
    );
  }

  try {
    validateInput(input);

    let output: string;
    if (mode === "encode") {
      output = encodeBase64(input, variant, padding);
    } else {
      output = decodeBase64(input, variant);
    }

    return NextResponse.json({ output } as Base64Response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
