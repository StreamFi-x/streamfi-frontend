// #860 feat(routes-f): soundex phonetic encoder

const SOUNDEX_MAP: Record<string, string> = {
  B: "1",
  F: "1",
  P: "1",
  V: "1",
  C: "2",
  G: "2",
  J: "2",
  K: "2",
  Q: "2",
  S: "2",
  X: "2",
  Z: "2",
  D: "3",
  T: "3",
  L: "4",
  M: "5",
  N: "5",
  R: "6",
};

/**
 * Encode a single word using the standard Soundex algorithm (letter + 3 digits).
 */
export function soundex(word: string): string {
  const upper = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (upper.length === 0) {
    return "";
  }

  const firstLetter = upper[0];
  const digits: string[] = [];
  let previousCode = SOUNDEX_MAP[firstLetter] ?? "0";

  for (let i = 1; i < upper.length; i += 1) {
    const letter = upper[i];
    const digit = SOUNDEX_MAP[letter] ?? "0";

    if (digit === "0") {
      continue;
    }

    // H/W between two same-code consonants suppresses the second consonant.
    if (
      (upper[i - 1] === "H" || upper[i - 1] === "W") &&
      digit === previousCode
    ) {
      continue;
    }

    if (digit !== digits[digits.length - 1]) {
      digits.push(digit);
    }

    previousCode = digit;
  }

  return `${firstLetter}${digits.join("")}000`.slice(0, 4);
}

export function encodeSoundexWords(words: string[]): string[] {
  return words.map((word) => soundex(word));
}
