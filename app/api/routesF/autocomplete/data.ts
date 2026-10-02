export type SuggestionType = 'creator' | 'category' | 'tag';

export type Suggestion = {
  type: SuggestionType;
  label: string;
  score: number;
};

export const corpus: Suggestion[] = [
  { type: 'creator', label: 'CryptoWhale', score: 100 },
  { type: 'creator', label: 'CrypticGamer', score: 85 },
  { type: 'category', label: 'Crypto Trading', score: 90 },
  { type: 'tag', label: 'crypto', score: 95 },
  { type: 'tag', label: 'bitcoin', score: 80 },
  { type: 'creator', label: 'BitcoinMaxi', score: 75 },
  { type: 'category', label: 'Just Chatting', score: 120 },
  { type: 'tag', label: 'chat', score: 110 }
];
