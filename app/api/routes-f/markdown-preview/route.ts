import { NextRequest, NextResponse } from "next/server";
import { processMarkdown } from "./_lib/helpers";
import type { MarkdownPreviewRequest, MarkdownPreviewResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: MarkdownPreviewRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { markdown, sanitize = true } = body;

  if (typeof markdown !== "string") {
    return NextResponse.json({ error: "markdown must be a string." }, { status: 400 });
  }

  try {
    const result = processMarkdown(markdown, sanitize);
    return NextResponse.json(result as MarkdownPreviewResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
