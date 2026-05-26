import { type NextRequest, NextResponse } from "next/server";
import { escapeHtml, unescapeHtml } from "./data";

const MAX_INPUT_BYTES = 1024 * 1024; // 1 MB

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { input, mode } = body as { input?: unknown; mode?: unknown };

  if (typeof input !== "string" || typeof mode !== "string") {
    return NextResponse.json({ error: "Invalid request body: 'input' and 'mode' are required" }, { status: 400 });
  }

  if (mode !== "escape" && mode !== "unescape") {
    return NextResponse.json({ error: "Invalid mode. Must be 'escape' or 'unescape'" }, { status: 400 });
  }

  if (Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES) {
    return NextResponse.json({ error: "Input too large (max 1 MB)" }, { status: 413 });
  }

  const output = mode === "escape" ? escapeHtml(input) : unescapeHtml(input);
  return NextResponse.json({ output });
}
