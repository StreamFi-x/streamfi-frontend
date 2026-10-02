import { NextRequest, NextResponse } from "next/server";
import { encodeSoundexWords, soundex } from "./soundex";

// #860 feat(routes-f): soundex phonetic encoder

type SoundexBody = {
  word?: unknown;
  words?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: SoundexBody;

  try {
    body = (await req.json()) as SoundexBody;
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

    return NextResponse.json({ code: soundex(body.word) });
  }

  if (!Array.isArray(body.words) || body.words.some((item) => typeof item !== "string")) {
    return badRequest("words must be an array of strings.");
  }

  return NextResponse.json({ codes: encodeSoundexWords(body.words) });
}
