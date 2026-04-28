import type { TextStatsResponse } from "./types";

/**
 * Naive syllable counter: count vowel-onset groups (aeiouy),
 * then subtract 1 for a trailing silent-e when count > 1.
 * Returns 0 for tokens with no alphabetic characters.
 */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;

  let count = 0;
  let prevWasVowel = false;

  for (const ch of cleaned) {
    const isVowel = "aeiouy".includes(ch);
    if (isVowel && !prevWasVowel) count++;
    prevWasVowel = isVowel;
  }

  // Silent-e: "make" → ma/ke → 2 groups → subtract 1 → 1
  if (cleaned.endsWith("e") && count > 1) count--;

  return Math.max(1, count);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function analyzeText(text: string): TextStatsResponse {
  const chars = text.length;
  const chars_no_spaces = text.replace(/\s/g, "").length;

  const trimmed = text.trim();
  const wordList = trimmed === "" ? [] : trimmed.split(/\s+/);
  const words = wordList.length;

  // Count terminal-punctuation groups; treat unpunctuated text as 1 sentence
  const sentenceMatches = text.match(/[.!?]+/g);
  const sentences = words === 0 ? 0 : (sentenceMatches?.length ?? 1);

  // Paragraphs are separated by one or more blank lines
  const paragraphs =
    words === 0
      ? 0
      : text.split(/\n\s*\n+/).filter((p) => p.trim().length > 0).length || 1;

  const avg_words_per_sentence =
    sentences > 0 ? round2(words / sentences) : 0;

  const syllable_count = wordList.reduce(
    (sum, w) => sum + countSyllables(w),
    0
  );

  // Flesch Reading Ease: 206.835 − 1.015×(words/sentences) − 84.6×(syllables/words)
  const flesch_reading_ease =
    words > 0 && sentences > 0
      ? round2(
          206.835 -
            1.015 * (words / sentences) -
            84.6 * (syllable_count / words)
        )
      : 0;

  // 200 WPM → seconds = (words / 200) * 60
  const reading_time_seconds = round2((words / 200) * 60);

  return {
    chars,
    chars_no_spaces,
    words,
    sentences,
    paragraphs,
    avg_words_per_sentence,
    flesch_reading_ease,
    syllable_count,
    reading_time_seconds,
  };
}
