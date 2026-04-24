export interface EchoResponse {
  method: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  body: unknown;
  url: string;
  timestamp: string;
  truncated?: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';