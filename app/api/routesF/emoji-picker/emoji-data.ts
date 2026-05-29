import type { EmojiCategory, EmojiItem } from './types';

export const EMOJI_CATEGORIES: Record<EmojiCategory, EmojiItem[]> = {
  faces: [
    { emoji: '😀', name: 'grinning face', category: 'faces' },
    { emoji: '😅', name: 'grinning face with sweat', category: 'faces' },
    { emoji: '😍', name: 'smiling face with heart-eyes', category: 'faces' },
    { emoji: '🤔', name: 'thinking face', category: 'faces' },
    { emoji: '😎', name: 'smiling face with sunglasses', category: 'faces' },
    { emoji: '🥳', name: 'partying face', category: 'faces' },
    { emoji: '😢', name: 'crying face', category: 'faces' },
  ],
  animals: [
    { emoji: '🐶', name: 'dog face', category: 'animals' },
    { emoji: '🐱', name: 'cat face', category: 'animals' },
    { emoji: '🦊', name: 'fox face', category: 'animals' },
    { emoji: '🐼', name: 'panda face', category: 'animals' },
    { emoji: '🐵', name: 'monkey face', category: 'animals' },
    { emoji: '🦁', name: 'lion face', category: 'animals' },
    { emoji: '🐧', name: 'penguin', category: 'animals' },
  ],
  food: [
    { emoji: '🍎', name: 'red apple', category: 'food' },
    { emoji: '🍕', name: 'pizza', category: 'food' },
    { emoji: '🍉', name: 'watermelon', category: 'food' },
    { emoji: '🍪', name: 'cookie', category: 'food' },
    { emoji: '🥐', name: 'croissant', category: 'food' },
    { emoji: '🍣', name: 'sushi', category: 'food' },
    { emoji: '🍩', name: 'doughnut', category: 'food' },
  ],
};

export const ALL_EMOJI_ITEMS = [
  ...EMOJI_CATEGORIES.faces,
  ...EMOJI_CATEGORIES.animals,
  ...EMOJI_CATEGORIES.food,
];

export const ALL_CATEGORIES = ['faces', 'animals', 'food', 'any'] as const;
export type EmojiFilterCategory = (typeof ALL_CATEGORIES)[number];

export function getEmojiPool(category: EmojiFilterCategory) {
  return category === 'any' ? ALL_EMOJI_ITEMS : EMOJI_CATEGORIES[category];
}
