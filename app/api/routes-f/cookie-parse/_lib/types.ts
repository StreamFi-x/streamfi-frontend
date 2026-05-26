export type SameSite = "Strict" | "Lax" | "None";

export interface ParsedCookie {
  value: string;
  expires?: string;
  max_age?: number;
  domain?: string;
  path?: string;
  secure: boolean;
  http_only: boolean;
  same_site?: SameSite;
}

export interface CookieParseResponse {
  [name: string]: ParsedCookie;
}

export interface CookieBuildInput {
  name: string;
  value: string;
  expires?: string;
  max_age?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  http_only?: boolean;
  same_site?: SameSite;
}

export interface CookieBuildResponse {
  header: string;
}
