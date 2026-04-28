import { NextRequest, NextResponse } from "next/server";
import { processMarkdown } from "./_lib/helpers";
import type { MarkdownRequest, MarkdownResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: MarkdownRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { markdown } = body;

  if (typeof markdown !== "string") {
    return NextResponse.json({ error: "markdown must be a string." }, { status: 400 });
  }

  try {
    const html = processMarkdown(markdown);
    return NextResponse.json({ html } as MarkdownResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
