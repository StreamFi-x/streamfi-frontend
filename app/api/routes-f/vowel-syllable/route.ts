import { NextRequest, NextResponse } from "next/server";

function countSyllablesInWord(rawWord: string) {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) {return 0;}

  const groups = word.match(/[aeiouy]+/g)?.length ?? 0;
  const hasConsonantLeEnding = /[^aeiou]le$/.test(word);
  const silentE =
    word.length > 2 &&
    /e$/.test(word) &&
    !/[aeiouy]{2}e$/.test(word) &&
    !hasConsonantLeEnding;
  const syllables = groups - (silentE ? 1 : 0);
  return Math.max(1, syllables);
}

export async function POST(request: NextRequest) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.text !== "string") {
    return NextResponse.json(
      { error: "text must be a string" },
      { status: 400 }
    );
  }

  const letters = body.text.match(/[a-z]/gi) ?? [];
  const vowels = letters.filter(char => /[aeiou]/i.test(char)).length;
  const consonants = letters.length - vowels;
  const words = body.text.match(/[a-z]+/gi) ?? [];
  const syllables = words.reduce(
    (sum, word) => sum + countSyllablesInWord(word),
    0
  );

  return NextResponse.json({
    vowels,
    consonants,
    syllables,
    words: words.length,
  });
}
