/**
 * Supported hashing algorithms.
 * md5 and sha1 are included for checksum/debugging use only —
 * they are NOT cryptographically secure.
 */
export type HashAlgorithm = "md5" | "sha1" | "sha256" | "sha512";

/**
 * Output encoding for the digest.
 * Defaults to "hex" when omitted.
 */
export type HashEncoding = "hex" | "base64";

/** Shape of the POST /api/routes-f/hash request body. */
export interface HashRequestBody {
  input: string;
  algorithm: HashAlgorithm;
  encoding?: HashEncoding;
}

/** Shape of a successful response. */
export interface HashSuccessResponse {
  hash: string;
  algorithm: HashAlgorithm;
  encoding: HashEncoding;
  /** Present only for algorithms that are not cryptographically secure. */
  warning?: string;
}

/** Shape of an error response. */
export interface HashErrorResponse {
  error: string;
}
