export interface SpellCheckRequest {
  text: string;
  max_suggestions?: number;
}

export interface MisspelledWord {
  word: string;
  position: number;
  suggestions: string[];
}

export interface SpellCheckResponse {
  misspelled: MisspelledWord[];
}
