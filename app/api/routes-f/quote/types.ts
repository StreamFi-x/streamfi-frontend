export interface Quote {
  id: number;
  text: string;
  author: string;
  category: string;
  year?: number;
}

export interface QuoteResponse {
  id: number;
  text: string;
  author: string;
  category: string;
  year?: number;
}

export interface QuoteListResponse {
  quotes: QuoteResponse[];
  total: number;
}
