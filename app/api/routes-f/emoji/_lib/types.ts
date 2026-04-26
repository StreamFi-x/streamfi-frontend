export type EmojiCategory =
  | "smileys"
  | "people"
  | "nature"
  | "food"
  | "travel"
  | "objects"
  | "symbols"
  | "flags";

export interface Emoji {
  char: string;
  name: string;
  shortcode: string;
  category: EmojiCategory;
  keywords: string[];
}

export interface EmojiResult {
  char: string;
  name: string;
  shortcode: string;
  category: EmojiCategory;
  keywords: string[];
}
