import { createHash } from "crypto";

/**
 * `Idempotency-Key` request header contract (#1401).
 *
 * The client generates one opaque key per logical operation (a UUID v4 is
 * recommended), sends it on the first attempt and reuses it unchanged for
 * every retry of that operation. Keys are 8-255 printable ASCII characters
 * without spaces.
 */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
export const IDEMPOTENCY_REPLAYED_HEADER = "Idempotency-Replayed";

const KEY_PATTERN = /^[\x21-\x7E]{8,255}$/;

export type KeyValidation =
  | { ok: true; key: string }
  | {
      ok: false;
      error: "idempotency_key_required" | "idempotency_key_invalid";
    };

export function validateIdempotencyKey(value: string | null): KeyValidation {
  if (value === null || value.trim() === "") {
    return { ok: false, error: "idempotency_key_required" };
  }
  if (!KEY_PATTERN.test(value)) {
    return { ok: false, error: "idempotency_key_invalid" };
  }
  return { ok: true, key: value };
}

/** JSON with object keys sorted, so equal requests hash equally. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Hash identifying "the same request": operation scope plus the validated
 * request payload. Only the hash is stored, never the payload.
 */
export function requestFingerprint(scope: string, payload: unknown): string {
  return createHash("sha256")
    .update(`${scope}\n${canonicalJson(payload)}`, "utf8")
    .digest("hex");
}
