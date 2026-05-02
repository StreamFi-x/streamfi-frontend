export interface WordFrequencyRequest {
  text: string;
  top_n?: number;
  exclude_stopwords?: boolean;
}

export interface WordEntry {
  word: string;
  count: number;
  rarity_score: number;
}

export interface WordFrequencyResponse {
  total_words: number;
  unique_words: number;
  top: WordEntry[];
}
