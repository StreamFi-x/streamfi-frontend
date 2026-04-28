export interface ShortenRequest {
  url: string;
}

export interface ShortenResponse {
  code: string;
  short_url: string;
}

export interface LookupResponse {
  url: string;
  hits: number;
}

export interface UrlEntry {
  url: string;
  hits: number;
  createdAt: Date;
}

export interface ValidationError {
  message: string;
  code: 'INVALID_URL' | 'UNSAFE_SCHEME' | 'EMPTY_URL';
}
