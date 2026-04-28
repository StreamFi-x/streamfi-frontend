import { NextRequest, NextResponse } from "next/server";

function normalize(isbn: string): string {
  return isbn.replace(/[\s-]/g, "").toUpperCase();
}

function validateIsbn10(isbn: string): boolean {
  if (isbn.length !== 10) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const d = parseInt(isbn[i], 10);
    if (isNaN(d)) {
      return false;
    }
    sum += (10 - i) * d;
  }
  const last = isbn[9];
  sum += last === "X" ? 10 : parseInt(last, 10);
  if (isNaN(sum)) {
    return false;
  }
  return sum % 11 === 0;
}

function validateIsbn13(isbn: string): boolean {
  if (isbn.length !== 13) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = parseInt(isbn[i], 10);
    if (isNaN(d)) {
      return false;
    }
    sum += i % 2 === 0 ? d : d * 3;
  }
  return sum % 10 === 0;
}

function isbn10ToIsbn13(isbn10: string): string {
  const base = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(base[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

export async function POST(req: NextRequest) {
  let body: { isbn?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body?.isbn;
  if (typeof raw !== "string" || !raw.trim()) {
    return NextResponse.json({ error: "isbn is required" }, { status: 400 });
  }

  const normalized = normalize(raw);

  if (validateIsbn10(normalized)) {
    return NextResponse.json({
      valid: true,
      type: "isbn-10",
      normalized,
      convertible_to_13: isbn10ToIsbn13(normalized),
    });
  }

  if (validateIsbn13(normalized)) {
    return NextResponse.json({ valid: true, type: "isbn-13", normalized });
  }

  return NextResponse.json({ valid: false, type: null, normalized });
}
