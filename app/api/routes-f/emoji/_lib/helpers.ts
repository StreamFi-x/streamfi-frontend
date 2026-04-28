import type { Emoji, EmojiResult } from "./types";

type RelevanceScore = 0 | 1 | 2 | 3;

function score(emoji: Emoji, q: string): RelevanceScore {
  const query = q.toLowerCase();
  if (emoji.name === query) {
    return 3;
  }
  if (emoji.shortcode === query) {
    return 2;
  }
  if (emoji.keywords.includes(query)) {
    return 1;
  }
  if (
    emoji.name.includes(query) ||
    emoji.shortcode.includes(query) ||
    emoji.keywords.some((k) => k.includes(query))
  ) {
    return 0;
  }
  return -1 as unknown as RelevanceScore;
}

export function searchEmojis(
  emojis: Emoji[],
  q?: string,
  category?: string,
  limit = 20
): EmojiResult[] {
  const cap = Math.min(limit, 100);
  let pool = emojis;

  if (category) {
    pool = pool.filter((e) => e.category === category);
  }

  if (!q) {
    return pool.slice(0, cap).map(toResult);
  }

  const scored = pool
    .map((e) => ({ e, s: score(e, q) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => b.s - a.s);

  return scored.slice(0, cap).map(({ e }) => toResult(e));
}

function toResult(e: Emoji): EmojiResult {
  return {
    char: e.char,
    name: e.name,
    shortcode: e.shortcode,
    category: e.category,
    keywords: e.keywords,
  };
}
