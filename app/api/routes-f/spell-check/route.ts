import { NextRequest, NextResponse } from "next/server";
import type { SpellCheckRequest, SpellCheckResponse } from "./_lib/types";
import {
  extractWordsWithPosition,
  getDictionary,
  getSuggestions,
} from "./_lib/spell";

const MAX_INPUT_BYTES = 100 * 1024;
const DEFAULT_MAX_SUGGESTIONS = 5;
const HARD_MAX_SUGGESTIONS = 10;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: SpellCheckRequest;

  try {
    body = (await request.json()) as SpellCheckRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body.text !== "string") {
    return NextResponse.json(
      { error: "text must be a string" },
      { status: 400 }
    );
  }

  const sizeBytes = Buffer.byteLength(body.text, "utf8");
  if (sizeBytes > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: `Input exceeds ${MAX_INPUT_BYTES} bytes` },
      { status: 413 }
    );
  }

  const maxSuggestions = Number.isFinite(body.max_suggestions)
    ? Math.max(
        1,
        Math.min(
          HARD_MAX_SUGGESTIONS,
          Math.floor(body.max_suggestions as number)
        )
      )
    : DEFAULT_MAX_SUGGESTIONS;

  const { dictionary, dictionaryList } = getDictionary();
  const words = extractWordsWithPosition(body.text);

  const misspelled = words
    .filter(({ word }) => !dictionary.has(word))
    .map(({ word, position }) => ({
      word,
      position,
      suggestions: getSuggestions(word, dictionaryList, maxSuggestions),
    }));

  const response: SpellCheckResponse = { misspelled };
  return NextResponse.json(response);
}
