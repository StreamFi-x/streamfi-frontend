import { NextRequest, NextResponse } from "next/server";
import { normalize, isPalindrome } from "./_lib/helpers";
import type { PalindromeRequest } from "./_lib/types";

const MAX_CHARS = 10_000;

export async function POST(req: NextRequest) {
  let body: PalindromeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text, ignore_case = true, ignore_punct = true, ignore_whitespace = true } = body;

  if (typeof text !== "string") {
    return NextResponse.json({ error: "text must be a string." }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Input exceeds maximum length of ${MAX_CHARS} characters.` },
      { status: 400 }
    );
  }

  const normalized = normalize(text, ignore_case, ignore_punct, ignore_whitespace);
  return NextResponse.json({ is_palindrome: isPalindrome(normalized), normalized });
}
