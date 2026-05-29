export type EmojiCategory = 'faces' | 'animals' | 'food';

export interface EmojiItem {
  emoji: string;
  name: string;
  category: EmojiCategory;
}

export interface EmojiListResponse {
  emojis: EmojiItem[];
}
