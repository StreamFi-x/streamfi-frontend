import { NextRequest, NextResponse } from "next/server";
import { encodeMetaphoneWords, metaphone } from "./metaphone";

// #886 feat(routesF): metaphone phonetic encoder

type MetaphoneBody = {
  word?: unknown;
  words?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: MetaphoneBody;

  try {
    body = (await req.json()) as MetaphoneBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const hasWord = body.word !== undefined;
  const hasWords = body.words !== undefined;

  if (hasWord === hasWords) {
    return badRequest("Provide exactly one of word or words.");
  }

  if (hasWord) {
    if (typeof body.word !== "string") {
      return badRequest("word must be a string.");
    }

    return NextResponse.json({ code: metaphone(body.word) });
  }

  if (!Array.isArray(body.words) || body.words.some((item) => typeof item !== "string")) {
    return badRequest("words must be an array of strings.");
  }

  return NextResponse.json({ codes: encodeMetaphoneWords(body.words) });
}
