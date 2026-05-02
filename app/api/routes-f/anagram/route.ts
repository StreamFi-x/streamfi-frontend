import { NextRequest, NextResponse } from "next/server";
import { WORD_LIST } from "./_lib/words";

const MAX_LEN = 30;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s/g, "");
}

function sortChars(s: string): string {
  return s.split("").sort().join("");
}

function areAnagrams(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length !== nb.length) {
    return false;
  }
  return sortChars(na) === sortChars(nb);
}

// POST /api/routes-f/anagram/check
export async function POST(req: NextRequest) {
  let body: { a?: string; b?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { a, b } = body ?? {};
  if (typeof a !== "string" || typeof b !== "string") {
    return NextResponse.json({ error: "a and b are required strings" }, { status: 400 });
  }
  if (a.length > MAX_LEN || b.length > MAX_LEN) {
    return NextResponse.json({ error: `Input capped at ${MAX_LEN} chars` }, { status: 400 });
  }

  return NextResponse.json({ is_anagram: areAnagrams(a, b) });
}

// GET /api/routes-f/anagram/find?word=listen
export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word") ?? "";
  if (!word.trim()) {
    return NextResponse.json({ error: "word query param is required" }, { status: 400 });
  }
  if (word.length > MAX_LEN) {
    return NextResponse.json({ error: `Input capped at ${MAX_LEN} chars` }, { status: 400 });
  }

  const normalized = normalize(word);
  const sorted = sortChars(normalized);

  // Deduplicate word list
  const unique = [...new Set(WORD_LIST)];

  const anagrams = unique.filter((w) => {
    const nw = normalize(w);
    return nw !== normalized && sortChars(nw) === sorted;
  });

  return NextResponse.json({ anagrams });
}
