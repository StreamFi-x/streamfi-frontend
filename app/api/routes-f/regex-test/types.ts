export interface RegexTestRequest {
  pattern: string;
  flags?: string;
  input: string;
}

export interface MatchResult {
  match: string;
  index: number;
  groups: string[];
  named_groups: Record<string, string>;
}

export interface RegexTestResponse {
  valid: boolean;
  matches: MatchResult[];
  total: number;
}
