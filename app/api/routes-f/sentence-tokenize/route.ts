import { NextRequest, NextResponse } from "next/server";
import { tokenize } from "./_lib/tokenizer";
import { abbreviationSet } from "./_lib/abbreviations";
import type { TokenizeRequest } from "./_lib/types";

const MAX_BYTES = 1024 * 1024; // 1 MB

export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: "Input exceeds 1 MB limit." }, { status: 413 });
  }

  let body: TokenizeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text } = body;

  if (typeof text !== "string") {
    return NextResponse.json({ error: "text must be a string." }, { status: 400 });
  }

  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Input exceeds 1 MB limit." }, { status: 413 });
  }

  const sentences = tokenize(text, abbreviationSet);
  return NextResponse.json({ sentences, count: sentences.length });
}
