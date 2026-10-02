/**
 * Errors raised by custodial-key encryption. Messages are fixed strings that
 * describe what failed — they never contain key material, ciphertext or
 * request payloads, so they are safe to log and to map to HTTP responses.
 */
export type CustodialKeyErrorCode =
  | "KMS_NOT_CONFIGURED"
  | "KMS_UNAVAILABLE"
  | "KMS_THROTTLED"
  | "KMS_ACCESS_DENIED"
  | "KMS_KEY_UNAVAILABLE"
  | "KMS_WRONG_KEY"
  | "KMS_INVALID_CIPHERTEXT"
  | "ENVELOPE_INVALID"
  | "ENVELOPE_AUTH_FAILED"
  | "LEGACY_KEY_UNAVAILABLE"
  | "LEGACY_FORMAT_INVALID"
  | "LEGACY_AUTH_FAILED"
  | "UNKNOWN_FORMAT";

export class CustodialKeyError extends Error {
  constructor(
    readonly code: CustodialKeyErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CustodialKeyError";
  }

  /**
   * True when retrying later may succeed (KMS outage/throttling). Callers
   * surface these as 503 — and must never fall back to another key.
   */
  get transient(): boolean {
    return this.code === "KMS_UNAVAILABLE" || this.code === "KMS_THROTTLED";
  }
}
