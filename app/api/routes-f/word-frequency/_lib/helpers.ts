import { STOPWORDS } from "./stopwords";
import { CORPUS, MAX_CORPUS_FREQ } from "./corpus";
import type { WordEntry } from "./types";

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
    .filter((w) => w.length > 0);
}

export function countWords(tokens: string[], excludeStopwords: boolean): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (excludeStopwords && STOPWORDS.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

export function rarityScore(word: string): number {
  const freq = CORPUS[word] ?? 0;
  if (freq === 0) {
    return 1.0; // unknown = maximally rare
  }
  // Inverse normalized: rare words score close to 1, common words close to 0
  return parseFloat((1 - freq / MAX_CORPUS_FREQ).toFixed(4));
}

export function buildTop(counts: Map<string, number>, topN: number): WordEntry[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count, rarity_score: rarityScore(word) }));
}
