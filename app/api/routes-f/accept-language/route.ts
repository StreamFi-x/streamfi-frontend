import { NextRequest, NextResponse } from "next/server";
import { bestMatch, parseAcceptLanguage } from "./_lib/parser";

type RequestBody = {
  header?: unknown;
  supported?: unknown;
};

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.header !== "string") {
    return NextResponse.json({ error: "header must be a string" }, { status: 400 });
  }
  if (
    !Array.isArray(body.supported) ||
    !body.supported.every((locale) => typeof locale === "string")
  ) {
    return NextResponse.json(
      { error: "supported must be an array of strings" },
      { status: 400 },
    );
  }

  const parsed = parseAcceptLanguage(body.header);

  return NextResponse.json({
    parsed,
    best_match: bestMatch(parsed, body.supported),
  });
}
