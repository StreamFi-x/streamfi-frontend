import { NextRequest, NextResponse } from "next/server";
import { createComment, listCommentsFlat } from "./_lib/store";

const MAX_INPUT_SIZE = 1024 * 1024;

export async function GET() {
  const comments = listCommentsFlat();
  return NextResponse.json({ comments, count: comments.length });
}

export async function POST(req: NextRequest) {
  let body: { author?: unknown; text?: unknown; parent_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { author, text, parent_id } = body;

  if (typeof author !== "string" || author.trim().length === 0) {
    return NextResponse.json({ error: "author is required and must be a non-empty string." }, { status: 400 });
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required and must be a non-empty string." }, { status: 400 });
  }

  if (parent_id !== undefined && parent_id !== null && typeof parent_id !== "string") {
    return NextResponse.json({ error: "parent_id must be a string when provided." }, { status: 400 });
  }

  if (Buffer.byteLength(text, "utf8") > MAX_INPUT_SIZE) {
    return NextResponse.json({ error: "text exceeds 1MB limit." }, { status: 413 });
  }

  const created = createComment({
    author: author.trim(),
    text,
    parent_id: parent_id ?? null,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  return NextResponse.json({ comment: created.comment }, { status: 201 });
}
