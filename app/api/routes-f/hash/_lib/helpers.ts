// Use require() to bypass Next.js's ESM alias of crypto → uncrypto in tests.
// The uncrypto polyfill doesn't export createHash, so we need Node's built-in.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHash } = require("crypto") as typeof import("crypto");
import type { HashAlgorithm, HashEncoding } from "./types";

/** All algorithms the endpoint accepts. */
export const SUPPORTED_ALGORITHMS: ReadonlySet<string> = new Set<HashAlgorithm>(
  ["md5", "sha1", "sha256", "sha512"]
);

/** All encodings the endpoint accepts. */
export const SUPPORTED_ENCODINGS: ReadonlySet<string> = new Set<HashEncoding>([
  "hex",
  "base64",
]);

/**
 * Algorithms that are no longer considered cryptographically secure.
 * We still support them for checksum / debugging purposes but surface a warning.
 */
export const INSECURE_ALGORITHMS: ReadonlySet<HashAlgorithm> = new Set<HashAlgorithm>(
  ["md5", "sha1"]
);

/**
 * Human-readable warning message for insecure algorithms.
 * Kept in one place so tests can import and assert against it.
 */
export const INSECURE_WARNING =
  "This algorithm is not cryptographically secure and should not be used for security-sensitive purposes.";

/**
 * Compute a hash digest.
 *
 * @param input     - The string to hash (UTF-8 encoded).
 * @param algorithm - One of the supported HashAlgorithm values.
 * @param encoding  - Output encoding; defaults to "hex".
 * @returns The hex- or base64-encoded digest string.
 */
export function computeHash(
  input: string,
  algorithm: HashAlgorithm,
  encoding: HashEncoding = "hex"
): string {
  return createHash(algorithm).update(input, "utf8").digest(encoding);
}

/** Type-guard: checks whether a value is a supported algorithm. */
export function isSupportedAlgorithm(value: unknown): value is HashAlgorithm {
  return typeof value === "string" && SUPPORTED_ALGORITHMS.has(value);
}

/** Type-guard: checks whether a value is a supported encoding. */
export function isSupportedEncoding(value: unknown): value is HashEncoding {
  return typeof value === "string" && SUPPORTED_ENCODINGS.has(value);
}
