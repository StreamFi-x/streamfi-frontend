// #889 feat(routesF): caesar cipher brute force

/**
 * Relative English letter frequencies (A–Z), normalized to sum to 1.
 */
const ENGLISH_FREQ: Record<string, number> = {
  A: 0.08167,
  B: 0.01492,
  C: 0.02782,
  D: 0.04253,
  E: 0.12702,
  F: 0.02228,
  G: 0.02015,
  H: 0.06094,
  I: 0.06966,
  J: 0.00153,
  K: 0.00772,
  L: 0.04025,
  M: 0.02406,
  N: 0.06749,
  O: 0.07507,
  P: 0.01929,
  Q: 0.00095,
  R: 0.05987,
  S: 0.06327,
  T: 0.09056,
  U: 0.02758,
  V: 0.00978,
  W: 0.0236,
  X: 0.0015,
  Y: 0.01974,
  Z: 0.00074,
};

/**
 * Score how English-like a string is using log-likelihood against letter
 * frequencies. Higher scores indicate more plausible English plaintext.
 */
export function englishLikenessScore(text: string): number {
  const letters = text.match(/[a-zA-Z]/g);
  if (!letters || letters.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const letter of letters) {
    const upper = letter.toUpperCase();
    counts.set(upper, (counts.get(upper) ?? 0) + 1);
  }

  const total = letters.length;
  let score = 0;

  for (const [letter, count] of counts.entries()) {
    const observed = count / total;
    const expected = ENGLISH_FREQ[letter] ?? 0.0001;
    score += observed * Math.log(expected);
  }

  return score;
}
