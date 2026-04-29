import { NextRequest, NextResponse } from "next/server";
import { generateParagraphs, parseRequest } from "./_lib/generator";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseRequest((body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  return NextResponse.json({
    paragraphs: generateParagraphs(parsed.count, parsed.style, parsed.rand),
  });
}
