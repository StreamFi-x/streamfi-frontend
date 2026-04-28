export interface TokenizeRequest {
  text: string;
}

export interface TokenizeResponse {
  sentences: string[];
  count: number;
}
