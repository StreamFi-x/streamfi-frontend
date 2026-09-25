/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';

const DEFAULT_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'if', 'because', 'than',
]);

function generateAcronym(phrase: string, includeStopwords: boolean = false): { acronym: string; words_used: string[] } {
  const words = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  const filteredWords = includeStopwords
    ? words
    : words.filter((word) => !DEFAULT_STOPWORDS.has(word));

  const acronym = filteredWords.map((word) => word.charAt(0).toUpperCase()).join('');

  return {
    acronym,
    words_used: filteredWords,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phrase, include_stopwords = false } = body;

    if (!phrase || typeof phrase !== 'string' || phrase.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid phrase' },
        { status: 400 }
      );
    }

    const result = generateAcronym(phrase, include_stopwords);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
}
