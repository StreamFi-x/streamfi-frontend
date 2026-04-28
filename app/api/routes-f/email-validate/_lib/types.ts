export type EmailValidationReason =
  | "EMAIL_REQUIRED"
  | "EMAIL_TOO_LONG"
  | "MISSING_AT_SYMBOL"
  | "MULTIPLE_AT_SYMBOLS"
  | "MISSING_LOCAL_PART"
  | "MISSING_DOMAIN"
  | "UNSUPPORTED_QUOTED_LOCAL_PART"
  | "LOCAL_PART_TOO_LONG"
  | "LOCAL_PART_STARTS_OR_ENDS_WITH_DOT"
  | "LOCAL_PART_CONSECUTIVE_DOTS"
  | "LOCAL_PART_INVALID_CHARACTERS"
  | "DOMAIN_MISSING_DOT"
  | "DOMAIN_LABEL_EMPTY"
  | "DOMAIN_LABEL_TOO_LONG"
  | "DOMAIN_LABEL_STARTS_OR_ENDS_WITH_HYPHEN"
  | "DOMAIN_LABEL_INVALID_CHARACTERS"
  | "DOMAIN_TLD_INVALID";

export interface EmailValidationResult {
  valid: boolean;
  reasons: EmailValidationReason[];
  is_disposable: boolean;
  is_role_based: boolean;
  normalized: string;
}
