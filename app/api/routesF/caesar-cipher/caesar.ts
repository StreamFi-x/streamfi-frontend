// #889 feat(routesF): caesar cipher brute force

export type CaesarCandidate = {
  shift: number;
  text: string;
  score?: number;
};

/**
 * Decode ciphertext with a Caesar shift (only A–Z / a–z are rotated).
 */
export function caesarDecode(text: string, shift: number): string {
  const normalizedShift = ((shift % 26) + 26) % 26;
  if (normalizedShift === 0) {
    return text;
  }

  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(
      base + ((char.charCodeAt(0) - base - normalizedShift + 26) % 26)
    );
  });
}

/**
 * Produce all 25 non-zero Caesar decodings (shifts 1–25).
 */
export function bruteForceCaesar(text: string): CaesarCandidate[] {
  const candidates: CaesarCandidate[] = [];

  for (let shift = 1; shift <= 25; shift += 1) {
    candidates.push({
      shift,
      text: caesarDecode(text, shift),
    });
  }

  return candidates;
}
