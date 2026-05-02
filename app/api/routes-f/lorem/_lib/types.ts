export type LoremType = 'words' | 'sentences' | 'paragraphs';

export interface LoremOptions {
  type?: LoremType;
  count?: number;
  startLorem?: boolean;
}

export interface ApiResponse {
  text: string;
  error?: string;
}
