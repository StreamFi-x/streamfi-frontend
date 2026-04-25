import { NextRequest, NextResponse } from "next/server";
import { analyzeText } from "./_lib/helpers";

const MAX_BYTES = 500 * 1024; // 500 KB

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("text" in body)) {
    return NextResponse.json(
      { error: "Missing required field: text" },
      { status: 400 }
    );
  }

  const { text } = body as { text: unknown };

  if (typeof text !== "string") {
    return NextResponse.json(
      { error: "Field 'text' must be a string" },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    return NextResponse.json(
      { error: "Input exceeds 500 KB limit" },
      { status: 413 }
    );
  }

  return NextResponse.json(analyzeText(text), { status: 200 });
}
