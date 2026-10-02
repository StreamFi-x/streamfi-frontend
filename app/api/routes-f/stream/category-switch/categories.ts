export const VALID_CATEGORIES = [
  "gaming",
  "music",
  "irl",
  "art",
  "just-chatting",
  "sports",
  "education",
  "technology",
  "cooking",
  "fitness",
  "crypto",
  "nft",
  "defi",
  "other",
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];

export function isValidCategory(value: string): value is Category {
  return VALID_CATEGORIES.includes(value as Category);
}
