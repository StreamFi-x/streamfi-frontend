import { NextRequest, NextResponse } from "next/server";
import { tokenize, countWords, buildTop } from "./_lib/helpers";
import type { WordFrequencyRequest } from "./_lib/types";

const MAX_BYTES = 500 * 1024; // 500 KB

export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: "Input exceeds 500 KB limit." }, { status: 413 });
  }

  let body: WordFrequencyRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text, top_n = 10, exclude_stopwords = false } = body;

  if (typeof text !== "string") {
    return NextResponse.json({ error: "text must be a string." }, { status: 400 });
  }

  // Guard against large payloads that slipped past content-length check
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Input exceeds 500 KB limit." }, { status: 413 });
  }

  const clampedTopN = Math.min(Math.max(1, top_n), 100);

  const tokens = tokenize(text);
  const counts = countWords(tokens, exclude_stopwords);
  const top = buildTop(counts, clampedTopN);

  return NextResponse.json({
    total_words: tokens.length,
    unique_words: counts.size,
    top,
  });
}
