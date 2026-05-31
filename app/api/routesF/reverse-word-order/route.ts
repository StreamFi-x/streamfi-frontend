import { NextResponse } from "next/server";

/**
 * Reverses the order of words in the given text.
 * Collapses internal whitespace to single spaces and trims leading/trailing whitespace.
 */
function reverseWordOrder(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .reverse()
    .join(" ");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { text } = body as Record<string, unknown>;

  if (typeof text !== "string") {
    return NextResponse.json({ error: "text must be a string." }, { status: 400 });
  }

  const result = reverseWordOrder(text);

  return NextResponse.json({ result });
}
