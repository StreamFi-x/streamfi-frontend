// Charset-range language detection heuristic, bundled inside this folder per
// the routes-f scope constraint. Counts characters per Unicode script block and
// returns the language whose script dominates; Latin text defaults to English.

interface ScriptRange {
  language: string;
  start: number;
  end: number;
}

const SCRIPT_RANGES: ScriptRange[] = [
  { language: "ja", start: 0x3040, end: 0x30ff }, // Hiragana + Katakana
  { language: "ko", start: 0xac00, end: 0xd7af }, // Hangul syllables
  { language: "zh", start: 0x4e00, end: 0x9fff }, // CJK unified ideographs
  { language: "ar", start: 0x0600, end: 0x06ff }, // Arabic
  { language: "ru", start: 0x0400, end: 0x04ff }, // Cyrillic
  { language: "hi", start: 0x0900, end: 0x097f }, // Devanagari
  { language: "en", start: 0x0041, end: 0x024f }, // Latin (incl. extended)
];

export const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "pt", "ru", "zh", "ja", "ko", "ar", "hi"];

export function detectLanguage(text: string): string {
  const counts: Record<string, number> = {};

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    for (const range of SCRIPT_RANGES) {
      if (code >= range.start && code <= range.end) {
        counts[range.language] = (counts[range.language] || 0) + 1;
        break;
      }
    }
  }

  let best = "en";
  let bestCount = 0;
  for (const [language, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = language;
      bestCount = count;
    }
  }

  return best;
}
