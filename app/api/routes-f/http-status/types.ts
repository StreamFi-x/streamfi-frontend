export interface HttpStatus {
  code: number;
  name: string;
  description: string;
  category: '1xx' | '2xx' | '3xx' | '4xx' | '5xx';
  rfc?: string;
}

export interface HttpStatusResponse {
  code: number;
  name: string;
  description: string;
  category: '1xx' | '2xx' | '3xx' | '4xx' | '5xx';
  rfc?: string;
}

export interface HttpStatusListResponse {
  [category: string]: HttpStatusResponse[];
}
