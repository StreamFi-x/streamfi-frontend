import type { CharStatsResponse } from "./types";

const MAX_INPUT_BYTES = 1024 * 1024; // 1MB

// Unicode property regexes
const RE_LETTER = /\p{L}/u;
const RE_DIGIT = /\p{N}/u;
const RE_WHITESPACE = /\p{Z}|\t|\n|\r/u;
const RE_PUNCTUATION = /\p{P}/u;
const RE_SYMBOL = /\p{S}/u;

// Script ranges
const RE_LATIN = /\p{Script=Latin}/u;
const RE_CYRILLIC = /\p{Script=Cyrillic}/u;
const RE_CJK = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u;
const RE_ARABIC = /\p{Script=Arabic}/u;
const RE_DEVANAGARI = /\p{Script=Devanagari}/u;
const RE_GREEK = /\p{Script=Greek}/u;
const RE_HEBREW = /\p{Script=Hebrew}/u;

// Emoji detection (handles ZWJ sequences and multi-codepoint emoji)
const RE_EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
const RE_EMOJI_SEQUENCE =
  /\p{Emoji_Presentation}(?:️?⃐-⃿|⃣|️)*(?:‍(?:\p{Emoji_Presentation}(?:️?⃐-⃿|⃣|️)*))*|\p{Extended_Pictographic}/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countEmoji(text: string): number {
  return [...text.matchAll(RE_EMOJI_SEQUENCE)].length;
}

export function computeCharStats(input: unknown): CharStatsResponse {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  const { text } = input as Record<string, unknown>;

  if (typeof text !== "string") {
    throw new Error("text must be a string.");
  }

  if (Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES) {
    throw new Error("text must not exceed 1MB.");
  }

  // Segment into grapheme clusters (handles multi-codepoint emoji)
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = [...segmenter.segment(text)].map((s) => s.segment);

  let letters = 0,
    digits = 0,
    whitespace = 0,
    punctuation = 0,
    symbols = 0,
    other = 0;

  const scriptCounts = {
    latin: 0,
    cyrillic: 0,
    cjk: 0,
    arabic: 0,
    devanagari: 0,
    greek: 0,
    hebrew: 0,
    other: 0,
  };

  const emojiCount = countEmoji(text);

  // Build a set of emoji grapheme positions to avoid double-counting
  const emojiSet = new Set<string>();
  for (const m of text.matchAll(RE_EMOJI_SEQUENCE)) {
    emojiSet.add(m[0]);
  }

  for (const g of graphemes) {
    // Check if it's an emoji grapheme
    if (RE_EMOJI.test(g) || (g.length > 1 && emojiSet.has(g))) {
      // counted separately
      continue;
    }

    const firstChar = g[0];

    if (RE_WHITESPACE.test(firstChar)) {
      whitespace++;
    } else if (RE_LETTER.test(firstChar)) {
      letters++;
      if (RE_LATIN.test(firstChar)) scriptCounts.latin++;
      else if (RE_CYRILLIC.test(firstChar)) scriptCounts.cyrillic++;
      else if (RE_CJK.test(firstChar)) scriptCounts.cjk++;
      else if (RE_ARABIC.test(firstChar)) scriptCounts.arabic++;
      else if (RE_DEVANAGARI.test(firstChar)) scriptCounts.devanagari++;
      else if (RE_GREEK.test(firstChar)) scriptCounts.greek++;
      else if (RE_HEBREW.test(firstChar)) scriptCounts.hebrew++;
      else scriptCounts.other++;
    } else if (RE_DIGIT.test(firstChar)) {
      digits++;
    } else if (RE_PUNCTUATION.test(firstChar)) {
      punctuation++;
    } else if (RE_SYMBOL.test(firstChar)) {
      symbols++;
    } else {
      other++;
    }
  }

  return {
    total: graphemes.length,
    letters,
    digits,
    whitespace,
    punctuation,
    symbols,
    emoji: emojiCount,
    other,
    by_script: scriptCounts,
  };
}
