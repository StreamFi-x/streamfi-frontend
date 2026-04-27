import { NextRequest, NextResponse } from "next/server";
import { generate } from "./_lib/generator";
import type { PasswordGenRequest } from "./_lib/types";

const MIN_LENGTH = 4;
const MAX_LENGTH = 256;
const MIN_COUNT = 1;
const MAX_COUNT = 100;

export async function POST(req: NextRequest) {
  let body: PasswordGenRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    length = 16,
    count = 1,
    uppercase = true,
    lowercase = true,
    digits = true,
    symbols = true,
    exclude_ambiguous = false,
    must_include = [],
  } = body;

  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `length must be an integer between ${MIN_LENGTH} and ${MAX_LENGTH}.` },
      { status: 400 }
    );
  }
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    return NextResponse.json(
      { error: `count must be an integer between ${MIN_COUNT} and ${MAX_COUNT}.` },
      { status: 400 }
    );
  }
  if (!Array.isArray(must_include) || must_include.some((s) => typeof s !== "string")) {
    return NextResponse.json({ error: "must_include must be an array of strings." }, { status: 400 });
  }

  const mustTotalLength = must_include.reduce((acc, s) => acc + s.length, 0);
  if (mustTotalLength > length) {
    return NextResponse.json(
      { error: "Combined length of must_include strings exceeds password length." },
      { status: 400 }
    );
  }

  if (!uppercase && !lowercase && !digits && !symbols) {
    return NextResponse.json(
      { error: "At least one character class must be enabled." },
      { status: 400 }
    );
  }

  const result = generate({
    length,
    count,
    uppercase,
    lowercase,
    digits,
    symbols,
    excludeAmbiguous: exclude_ambiguous,
    mustInclude: must_include,
  });

  return NextResponse.json(result);
}
