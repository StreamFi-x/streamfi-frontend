export interface PasswordGenRequest {
  length?: number;
  count?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  exclude_ambiguous?: boolean;
  must_include?: string[];
}

export interface PasswordGenResponse {
  passwords: string[];
  strength_score: number;
}
