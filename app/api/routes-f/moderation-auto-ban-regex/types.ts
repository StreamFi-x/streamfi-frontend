export interface AutoBanRegexPattern {
  /** The regex source (no delimiters, e.g. "^spam.*bot$"). */
  pattern: string;
  /** Optional flags; only "i" and "g" are permitted. */
  flags: string;
  /** Free-text note describing why this pattern exists. */
  note: string;
  created_at: string;
}

export interface AutoBanRegexConfig {
  creator_id: string;
  patterns: AutoBanRegexPattern[];
  updated_at: string;
}

export interface AutoBanRegexResponse {
  creator_id: string;
  patterns: AutoBanRegexPattern[];
  updated_at: string;
}

export interface PutAutoBanRegexBody {
  creator_id: string;
  patterns: Array<{ pattern: string; flags?: string; note?: string }>;
}
