export type SimilarityAlgorithm = "jaccard" | "cosine" | "both";

export function tokenize(text: string): string[] {
  return Array.from(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

export function jaccardSimilarity(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));

  if (aTokens.size === 0 && bTokens.size === 0) {
    return 1;
  }

  const intersectionSize = Array.from(aTokens).reduce((count, token) => {
    return bTokens.has(token) ? count + 1 : count;
  }, 0);

  const unionSize = new Set([...aTokens, ...bTokens]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

export function cosineSimilarity(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);

  if (aTokens.length === 0 && bTokens.length === 0) {
    return 1;
  }

  const aFreq = new Map<string, number>();
  const bFreq = new Map<string, number>();

  for (const token of aTokens) {
    aFreq.set(token, (aFreq.get(token) ?? 0) + 1);
  }
  for (const token of bTokens) {
    bFreq.set(token, (bFreq.get(token) ?? 0) + 1);
  }

  let dotProduct = 0;
  let aSum = 0;
  let bSum = 0;

  for (const [token, aCount] of aFreq.entries()) {
    aSum += aCount * aCount;
    const bCount = bFreq.get(token) ?? 0;
    dotProduct += aCount * bCount;
  }

  for (const bCount of bFreq.values()) {
    bSum += bCount * bCount;
  }

  const denominator = Math.sqrt(aSum) * Math.sqrt(bSum);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function computeSimilarity(
  a: string,
  b: string,
  algorithm: SimilarityAlgorithm = "both"
): { jaccard?: number; cosine?: number } {
  const result: { jaccard?: number; cosine?: number } = {};

  if (algorithm === "jaccard" || algorithm === "both") {
    result.jaccard = jaccardSimilarity(a, b);
  }

  if (algorithm === "cosine" || algorithm === "both") {
    result.cosine = cosineSimilarity(a, b);
  }

  return result;
}
