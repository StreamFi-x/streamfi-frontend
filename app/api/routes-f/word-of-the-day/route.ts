import { NextRequest, NextResponse } from "next/server";
import { normalizeDateInput, selectWordForDate } from "./_lib/helpers";
import type { WordOfTheDayResponse } from "./_lib/types";
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const normalized = normalizeDateInput(dateParam);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const entry = selectWordForDate(normalized.dateIso);
  const response: WordOfTheDayResponse = {
    date: normalized.dateIso,
    word: entry.word,
    definition: entry.definition,
    part_of_speech: entry.part_of_speech,
    example_sentence: entry.example_sentence,
  };
  return NextResponse.json(response);
}
